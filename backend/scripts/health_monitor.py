"""
서버 헬스 모니터. 별도 창에서 계속 돌려두면 발표 중 이슈 즉시 인지.

사용:
    python scripts/health_monitor.py

동작:
    - 30초마다 http://minde.ai.kr:8000/health 폴링
    - 3연속 실패 or status != "ok" → Windows 토스트 + 경고음
    - 복구되면 → 복구 알림
    - 콘솔에 상태 표시 (색으로 구분)
    - scripts/health_monitor.log 에 이력 기록

환경변수:
    HEALTH_URL          - 모니터할 URL (기본 http://minde.ai.kr:8000/health)
    HEALTH_INTERVAL     - 폴링 간격 초 (기본 30)
    HEALTH_FAIL_THRESH  - 연속 실패 임계값 (기본 3)
    DISCORD_WEBHOOK     - (선택) Discord 웹훅 URL — 알림 자동 전송
"""
import os
import sys
import time
import json
from datetime import datetime
from pathlib import Path

try:
    import httpx
except ImportError:
    print("httpx 필요: pip install httpx")
    sys.exit(1)

sys.stdout.reconfigure(encoding='utf-8')

URL = os.environ.get('HEALTH_URL', 'http://minde.ai.kr:8000/health')
INTERVAL = int(os.environ.get('HEALTH_INTERVAL', '30'))
FAIL_THRESH = int(os.environ.get('HEALTH_FAIL_THRESH', '3'))
DISCORD_WEBHOOK = os.environ.get('DISCORD_WEBHOOK', '')

LOG_FILE = Path(__file__).parent / 'health_monitor.log'


# ANSI 색상 (Windows Terminal 지원)
G = '\033[32m'    # 초록
Y = '\033[33m'    # 노랑
R = '\033[31m'    # 빨강
D = '\033[0m'     # reset


def now() -> str:
    return datetime.now().strftime('%Y-%m-%d %H:%M:%S')


def log(msg: str):
    """콘솔 + 파일 로그."""
    line = f'[{now()}] {msg}'
    print(line)
    try:
        with open(LOG_FILE, 'a', encoding='utf-8') as f:
            f.write(line + '\n')
    except Exception:
        pass


def alert_toast(title: str, message: str):
    """Windows 토스트 알림."""
    try:
        # win10toast로 자연스러운 팝업 (없으면 msg box로 fallback)
        try:
            from win10toast import ToastNotifier
            toaster = ToastNotifier()
            toaster.show_toast(title, message, duration=10, threaded=True)
            return
        except ImportError:
            pass
        # Fallback: ctypes MessageBox (설치 없이 됨)
        import ctypes
        ctypes.windll.user32.MessageBoxW(0, message, title, 0x40)  # info icon
    except Exception as e:
        log(f'토스트 실패: {e}')


def alert_beep():
    """경고음 (Windows 기본)."""
    try:
        import winsound
        # 800Hz 300ms x 3
        for _ in range(3):
            winsound.Beep(800, 300)
    except Exception:
        # 대체: bell 문자
        print('\a\a\a', end='', flush=True)


def alert_discord(title: str, message: str, color: int):
    """Discord 웹훅 알림."""
    if not DISCORD_WEBHOOK:
        return
    try:
        httpx.post(
            DISCORD_WEBHOOK,
            json={
                'embeds': [{
                    'title': title,
                    'description': message,
                    'color': color,
                    'timestamp': datetime.utcnow().isoformat(),
                }]
            },
            timeout=5,
        )
    except Exception as e:
        log(f'Discord 실패: {e}')


def check_health() -> tuple[bool, str]:
    """헬스체크. (ok?, 상세 메시지) 반환."""
    try:
        r = httpx.get(URL, timeout=10)
        if r.status_code != 200:
            return False, f'HTTP {r.status_code}'
        data = r.json()
        status = data.get('status')
        if status == 'ok':
            uptime = data.get('uptime_seconds', 0)
            return True, f'ok (uptime {uptime}s)'
        elif status == 'degraded':
            errs = data.get('errors', [])
            checks = data.get('checks', {})
            failed = [k for k, v in checks.items() if not v]
            return True, f'degraded (일부 기능만 불가: {", ".join(failed) or errs})'
        else:
            checks = data.get('checks', {})
            failed = [k for k, v in checks.items() if not v]
            return False, f'DOWN — 실패: {", ".join(failed)}'
    except httpx.TimeoutException:
        return False, 'timeout'
    except httpx.ConnectError:
        return False, 'connection refused / DNS 실패'
    except Exception as e:
        return False, f'{type(e).__name__}: {e}'


def main():
    log(f'헬스 모니터 시작 — URL={URL}, 간격={INTERVAL}s, 실패 임계값={FAIL_THRESH}회')
    if DISCORD_WEBHOOK:
        log(f'Discord 웹훅: 활성화')
    else:
        log(f'Discord 웹훅: 비활성 (설정하려면 DISCORD_WEBHOOK env)')

    fail_count = 0
    was_down = False

    while True:
        ok, msg = check_health()

        if ok:
            # 정상
            if fail_count > 0 or was_down:
                # 복구
                log(f'{G}✅ 복구됨{D} — {msg}')
                alert_toast('MindE 서버 복구', f'서버가 다시 정상입니다.\n{msg}')
                alert_discord('✅ 서버 복구', msg, color=0x00FF00)
                fail_count = 0
                was_down = False
            else:
                # 계속 정상
                if 'degraded' in msg:
                    print(f'{Y}[{now()}] ⚠️  {msg}{D}')
                else:
                    print(f'{G}[{now()}] ✓ {msg}{D}')
        else:
            # 실패
            fail_count += 1
            print(f'{R}[{now()}] ✗ 실패 {fail_count}회 — {msg}{D}')

            if fail_count == FAIL_THRESH and not was_down:
                # 임계값 도달, 알림 발송
                log(f'{R}🚨 서버 다운 감지 (연속 {FAIL_THRESH}회 실패){D}')
                alert_toast('🚨 MindE 서버 다운!', f'서버 응답 없음\n원인: {msg}')
                alert_beep()
                alert_discord('🚨 서버 다운', f'연속 {FAIL_THRESH}회 실패\n원인: {msg}', color=0xFF0000)
                was_down = True

        time.sleep(INTERVAL)


if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        log('모니터 종료 (Ctrl+C)')
