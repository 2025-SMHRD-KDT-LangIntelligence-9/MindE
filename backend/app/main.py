# main.py
# FastAPI 애플리케이션의 진입점입니다.
# TODO: 라우터 등록(chatbot, complaint, ocr, voice, dashboard), CORS 설정, 미들웨어 추가

from fastapi import FastAPI

app = FastAPI(title="마음결 AI 민원 상담 플랫폼")


@app.get("/health")
def health_check():
    """서버 상태 확인용 헬스체크 엔드포인트"""
    return {"status": "ok"}


# TODO: app.include_router(chatbot.router) 등 라우터 연결
