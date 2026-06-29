import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CitizenLayout from '../../layouts/CitizenLayout';

function Toggle({ on, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`w-11 h-6 rounded-full relative transition-colors duration-200 shrink-0 ${on ? 'bg-primary' : 'bg-outline-variant'}`}
    >
      <div
        className="absolute top-1 left-1 bg-white w-4 h-4 rounded-full shadow transition-transform duration-200"
        style={{ transform: on ? 'translateX(20px)' : 'translateX(0px)' }}
      />
    </button>
  );
}

function Settings() {
  const navigate = useNavigate();
  const [verified,  setVerified]  = useState(false);
  const [pw,        setPw]        = useState('');
  const [showPw,    setShowPw]    = useState(false);
  const [pwError,    setPwError]    = useState('');
  const [confirmPw,  setConfirmPw]  = useState('');
  const [confirmErr, setConfirmErr] = useState('');
  const [saveOk,       setSaveOk]       = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawPw,   setWithdrawPw]   = useState('');
  const [withdrawErr,  setWithdrawErr]  = useState('');

  const handleSave = (e) => {
    e.preventDefault();
    if (!confirmPw) { setConfirmErr('현재 비밀번호를 입력해야 저장할 수 있습니다.'); return; }
    setConfirmErr('');
    setConfirmPw('');
    setSaveOk(true);
    setTimeout(() => setSaveOk(false), 2500);
  };

  const [channels, setChannels] = useState({
    '이메일 알림': true,
    '문자 알림 (SMS)': false,
    '앱 푸시 알림': true,
  });
  const [types, setTypes] = useState({
    '민원 접수 확인': true,
    '담당자 배정': true,
    '처리 상태 변경': true,
    '답변 완료': true,
    '공지 및 이벤트': false,
  });

  const toggle = (setState, key) => setState((p) => ({ ...p, [key]: !p[key] }));

  /* ── 비밀번호 확인 ── */
  if (!verified) {
    return (
      <CitizenLayout pageTitle="설정" activeMenu="settings">
        <div className="flex items-center justify-center min-h-[70vh]">
          <div className="w-full max-w-md">
            <div className="bg-white rounded-3xl border border-outline-variant shadow-lg overflow-hidden">
              {/* 그라디언트 헤더 */}
              <div className="bg-gradient-to-br from-primary to-blue-400 px-8 pt-8 pb-10 flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center mb-4 border border-white/30">
                  <span className="material-symbols-outlined text-white text-3xl">shield_lock</span>
                </div>
                <h2 className="text-xl font-bold text-white mb-1.5">본인 확인</h2>
                <p className="text-white/75 text-sm leading-relaxed">
                  개인 정보 보호를 위해<br />현재 비밀번호를 입력해 주세요.
                </p>
              </div>

              {/* 폼 영역 */}
              <div className="px-8 py-7">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!pw) { setPwError('비밀번호를 입력해주세요.'); return; }
                    setVerified(true);
                  }}
                  className="space-y-4"
                >
                  <div>
                    <label className="text-xs font-bold text-on-surface-variant block mb-1.5">현재 비밀번호</label>
                    <div className="relative">
                      <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[20px]">lock</span>
                      <input
                        type={showPw ? 'text' : 'password'}
                        value={pw}
                        onChange={(e) => { setPw(e.target.value); setPwError(''); }}
                        placeholder="비밀번호를 입력하세요"
                        className="w-full h-12 pl-10 pr-10 border border-outline-variant rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm"
                      />
                      <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface transition-colors">
                        <span className="material-symbols-outlined text-[20px]">{showPw ? 'visibility_off' : 'visibility'}</span>
                      </button>
                    </div>
                  </div>

                  {pwError && (
                    <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm">
                      <span className="material-symbols-outlined text-lg shrink-0">error</span>
                      {pwError}
                    </div>
                  )}

                  <button
                    type="submit"
                    className="w-full h-12 bg-primary text-white font-bold rounded-xl hover:brightness-105 active:scale-[0.98] transition-all shadow-md shadow-primary/30 flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-outlined text-lg">verified_user</span>
                    확인
                  </button>
                </form>

                <div className="mt-5 flex items-center gap-2 justify-center">
                  <span className="material-symbols-outlined text-on-surface-variant/50 text-base">info</span>
                  <p className="text-xs text-on-surface-variant/70">개인 정보는 암호화되어 안전하게 보호됩니다.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </CitizenLayout>
    );
  }

  return (
    <CitizenLayout pageTitle="설정" activeMenu="settings">

      {saveOk && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-slate-800 text-white text-sm font-bold px-5 py-3 rounded-xl shadow-lg flex items-center gap-2">
          <span className="material-symbols-outlined text-base">check_circle</span>변경 사항이 저장되었습니다.
        </div>
      )}

      <div className="grid grid-cols-2 gap-5 items-stretch">

        {/* ── 왼쪽: 하나의 카드 ── */}
        <form onSubmit={handleSave} className="bg-white rounded-2xl border border-outline-variant shadow-sm overflow-hidden flex flex-col">

          {/* 상태 대시보드 */}
          <div className="px-6 py-5 border-b border-outline-variant bg-gradient-to-r from-primary/5 to-blue-50/60">
            <p className="text-xs font-bold text-on-surface-variant mb-3">상태 대시보드</p>
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-primary text-4xl">account_circle</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <p className="font-bold text-on-surface">-</p>
                  <span className="bg-blue-50 text-blue-600 text-[11px] font-bold px-2 py-0.5 rounded-full">일반 시민</span>
                  <span className="bg-emerald-50 text-emerald-600 text-[11px] font-bold px-2 py-0.5 rounded-full">활성</span>
                </div>
                <div className="flex flex-col gap-1">
                  {[
                    { icon: 'mail',           value: '-' },
                    { icon: 'phone',          value: '-' },
                    { icon: 'calendar_today', value: '-' },
                  ].map((row) => (
                    <div key={row.icon} className="flex items-center gap-1.5 text-xs text-on-surface-variant">
                      <span className="material-symbols-outlined text-sm">{row.icon}</span>
                      {row.value}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* 기본 정보 */}
          <div className="px-6 py-5 border-b border-outline-variant">
            <p className="text-xs font-bold text-on-surface-variant mb-3">기본 정보 <span className="font-normal text-on-surface-variant/70">(선택 수정)</span></p>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-on-surface-variant block mb-1">성명</label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">person</span>
                  <input defaultValue="" placeholder="이름을 입력하세요" className="w-full h-10 pl-10 pr-4 rounded-xl border border-outline-variant focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm" />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-on-surface-variant block mb-1">전화번호</label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">phone</span>
                  <input defaultValue="" placeholder="전화번호를 입력하세요" className="w-full h-10 pl-10 pr-4 rounded-xl border border-outline-variant focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm" />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-on-surface-variant block mb-1">이메일 주소</label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">mail</span>
                  <input defaultValue="" placeholder="이메일 주소를 입력하세요" className="w-full h-10 pl-10 pr-4 rounded-xl border border-outline-variant focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm" />
                </div>
              </div>
            </div>
          </div>

          {/* 비밀번호 변경 */}
          <div className="px-6 py-5 border-b border-outline-variant">
            <p className="text-xs font-bold text-on-surface-variant mb-3">비밀번호 변경 <span className="font-normal text-on-surface-variant/70">(선택 수정)</span></p>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-on-surface-variant block mb-1">새 비밀번호</label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">lock_reset</span>
                  <input type="password" placeholder="새 비밀번호 입력" className="w-full h-10 pl-10 pr-4 rounded-xl border border-outline-variant focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm" />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-on-surface-variant block mb-1">새 비밀번호 확인</label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">lock_reset</span>
                  <input type="password" placeholder="새 비밀번호 재입력" className="w-full h-10 pl-10 pr-4 rounded-xl border border-outline-variant focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm" />
                </div>
              </div>
            </div>
          </div>

          {/* 현재 비밀번호 확인 + 저장 */}
          <div className="px-6 py-5">
            <p className="text-xs font-bold text-on-surface-variant mb-3">현재 비밀번호 확인 <span className="text-error">*</span></p>
            <div className="relative mb-3">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">lock</span>
              <input
                type="password"
                value={confirmPw}
                onChange={(e) => { setConfirmPw(e.target.value); setConfirmErr(''); }}
                placeholder="저장하려면 현재 비밀번호를 입력하세요"
                className={`w-full h-10 pl-10 pr-4 rounded-xl border focus:ring-2 outline-none transition-all text-sm ${confirmErr ? 'border-error focus:border-error focus:ring-error/20' : 'border-outline-variant focus:border-primary focus:ring-primary/20'}`}
              />
            </div>
            {confirmErr && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 px-3 py-2 rounded-xl text-xs mb-3">
                <span className="material-symbols-outlined text-base shrink-0">error</span>{confirmErr}
              </div>
            )}
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 bg-primary text-white text-sm font-bold py-2.5 rounded-xl hover:brightness-105 active:scale-[0.98] transition-all shadow-md shadow-primary/20"
            >
              <span className="material-symbols-outlined text-lg">save</span>
              변경 사항 저장
            </button>
          </div>
        </form>

        {/* ── 오른쪽: 알림 설정 ── */}
        <div className="flex flex-col gap-5 h-full">

          {/* 알림 유형 설정 */}
          <div className="bg-white rounded-2xl border border-outline-variant shadow-sm overflow-hidden flex-[3] flex flex-col">
            <div className="flex justify-between items-center px-6 py-4 border-b border-outline-variant shrink-0">
              <h3 className="font-bold">알림 유형 설정</h3>
              <p className="text-xs text-on-surface-variant">받을 유형을 선택하세요.</p>
            </div>
            <div className="flex-1 flex flex-col divide-y divide-outline-variant/50">
              {[
                { label: '민원 접수 확인', desc: '민원이 정상 접수되었을 때',             icon: 'task_alt' },
                { label: '담당자 배정',     desc: '민원 담당자가 배정되었을 때',           icon: 'assignment_ind' },
                { label: '처리 상태 변경', desc: '민원 처리 단계가 변경되었을 때',        icon: 'sync' },
                { label: '답변 완료',       desc: '민원에 대한 공식 답변이 등록되었을 때', icon: 'mark_email_read' },
                { label: '공지 및 이벤트', desc: '서비스 공지 및 이벤트 안내',            icon: 'campaign' },
              ].map((item) => (
                <div key={item.label} className="flex-1 flex items-center justify-between px-6 hover:bg-surface-container-low/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-surface-container flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-on-surface-variant text-base">{item.icon}</span>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-on-surface">{item.label}</p>
                      <p className="text-xs text-on-surface-variant mt-0.5">{item.desc}</p>
                    </div>
                  </div>
                  <Toggle on={types[item.label]} onClick={() => toggle(setTypes, item.label)} />
                </div>
              ))}
            </div>
          </div>

          {/* 알림 채널 설정 */}
          <div className="bg-white rounded-2xl border border-outline-variant shadow-sm overflow-hidden flex-[2] flex flex-col">
            <div className="flex justify-between items-center px-6 py-4 border-b border-outline-variant shrink-0">
              <h3 className="font-bold">알림 채널 설정</h3>
              <p className="text-xs text-on-surface-variant">받을 채널을 선택하세요.</p>
            </div>
            <div className="flex-1 flex flex-col divide-y divide-outline-variant/50">
              {[
                { label: '이메일 알림',     desc: '민원 처리 상태 및 공식 답변 수신', icon: 'mail',          color: 'bg-primary/10 text-primary' },
                { label: '문자 알림 (SMS)', desc: '긴급 공지 및 본인 인증 코드 전송', icon: 'sms',           color: 'bg-amber-50 text-amber-600' },
                { label: '앱 푸시 알림',    desc: '실시간 민원 상태 변경 알림',       icon: 'notifications', color: 'bg-emerald-50 text-emerald-600' },
              ].map((item) => (
                <div key={item.label} className="flex-1 flex items-center justify-between px-6 hover:bg-surface-container-low/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl ${item.color} flex items-center justify-center shrink-0`}>
                      <span className="material-symbols-outlined text-base">{item.icon}</span>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-on-surface">{item.label}</p>
                      <p className="text-xs text-on-surface-variant mt-0.5">{item.desc}</p>
                    </div>
                  </div>
                  <Toggle on={channels[item.label]} onClick={() => toggle(setChannels, item.label)} />
                </div>
              ))}
            </div>
            <div className="px-6 py-4 border-t border-outline-variant flex justify-end shrink-0">
              <button className="flex items-center gap-1 bg-primary text-white px-4 py-2 rounded-lg text-sm font-bold hover:brightness-95 transition-all">
                알림 저장
              </button>
            </div>
          </div>

          {/* 회원탈퇴 버튼 */}
          <button
            type="button"
            onClick={() => { setWithdrawOpen(true); setWithdrawPw(''); setWithdrawErr(''); }}
            className="w-full flex items-center justify-center gap-2 bg-red-500 text-white text-sm font-bold py-2.5 rounded-xl hover:bg-red-600 active:scale-[0.98] transition-all shadow-md shadow-red-200"
          >
            <span className="material-symbols-outlined text-lg">person_remove</span>
            회원탈퇴
          </button>

        </div>
      </div>

      {/* 회원탈퇴 확인 모달 */}
      {withdrawOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
            <div className="bg-red-50 px-6 py-5 flex items-center gap-3 border-b border-red-100">
              <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-red-500 text-xl">warning</span>
              </div>
              <div>
                <p className="font-bold text-red-600">정말 탈퇴하시겠습니까?</p>
                <p className="text-xs text-red-400 mt-0.5">이 작업은 취소할 수 없습니다.</p>
              </div>
            </div>
            <div className="px-6 py-5 space-y-4">
              <p className="text-sm text-on-surface-variant">탈퇴를 진행하려면 현재 비밀번호를 입력해 주세요.</p>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">lock</span>
                <input
                  type="password"
                  value={withdrawPw}
                  onChange={(e) => { setWithdrawPw(e.target.value); setWithdrawErr(''); }}
                  placeholder="현재 비밀번호 입력"
                  className={`w-full h-10 pl-10 pr-4 rounded-xl border focus:ring-2 outline-none transition-all text-sm ${withdrawErr ? 'border-red-400 focus:border-red-400 focus:ring-red-200' : 'border-outline-variant focus:border-primary focus:ring-primary/20'}`}
                />
              </div>
              {withdrawErr && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 px-3 py-2 rounded-xl text-xs">
                  <span className="material-symbols-outlined text-base shrink-0">error</span>{withdrawErr}
                </div>
              )}
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setWithdrawOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-outline-variant text-on-surface text-sm font-bold hover:bg-surface-container-low transition-all"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!withdrawPw) { setWithdrawErr('비밀번호를 입력해주세요.'); return; }
                    setWithdrawOpen(false);
                    navigate('/login');
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-bold hover:bg-red-600 active:scale-[0.98] transition-all shadow-md shadow-red-200"
                >
                  탈퇴 확인
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </CitizenLayout>
  );
}

export default Settings;
