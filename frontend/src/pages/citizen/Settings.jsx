import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CitizenLayout from '../../layouts/CitizenLayout';

const DEMO_PASSWORD = '1234';

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
  const [pwError,   setPwError]   = useState('');
  const [activeTab, setActiveTab] = useState('profile');

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
        <div className="max-w-sm mx-auto mt-16">
          <div className="bg-white rounded-2xl border border-outline-variant p-10 flex flex-col items-center shadow-sm">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-5">
              <span className="material-symbols-outlined text-primary text-3xl">lock</span>
            </div>
            <h2 className="text-lg font-bold text-on-surface mb-1">본인 확인</h2>
            <p className="text-sm text-on-surface-variant mb-8 text-center">설정을 변경하려면 현재 비밀번호를 입력해주세요.</p>
            <form onSubmit={(e) => { e.preventDefault(); if (!pw) { setPwError('비밀번호를 입력해주세요.'); return; } if (pw !== DEMO_PASSWORD) { setPwError('비밀번호가 올바르지 않습니다.'); return; } setVerified(true); }} className="w-full space-y-4">
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[20px]">lock</span>
                <input type={showPw ? 'text' : 'password'} value={pw}
                  onChange={(e) => { setPw(e.target.value); setPwError(''); }}
                  placeholder="현재 비밀번호 입력"
                  className="w-full h-12 pl-10 pr-10 border border-outline-variant rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all" />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-outline">
                  <span className="material-symbols-outlined text-[20px]">{showPw ? 'visibility_off' : 'visibility'}</span>
                </button>
              </div>
              {pwError && (
                <div className="flex items-center gap-2 bg-error-container text-error px-4 py-3 rounded-xl text-sm">
                  <span className="material-symbols-outlined text-lg">error</span>{pwError}
                </div>
              )}
              <button type="submit" className="w-full h-12 bg-primary text-white font-bold rounded-xl hover:brightness-95 transition-all">확인</button>
            </form>
            <p className="text-xs text-on-surface-variant mt-4">테스트 비밀번호: <span className="font-bold text-primary">1234</span></p>
          </div>
        </div>
      </CitizenLayout>
    );
  }

  const tabs = [
    { key: 'profile',      label: '회원 정보 수정', icon: 'person' },
    { key: 'notification', label: '알림 설정',      icon: 'notifications' },
  ];

  return (
    <CitizenLayout pageTitle="설정" activeMenu="settings">
      <div className="grid grid-cols-12 gap-6 max-w-5xl">

        {/* ── 왼쪽 사이드 ── */}
        <div className="col-span-3 flex flex-col gap-4">
          {/* 프로필 카드 */}
          <div className="bg-white rounded-2xl border border-outline-variant p-5 flex flex-col items-center text-center shadow-sm">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-3">
              <span className="material-symbols-outlined text-primary text-4xl">account_circle</span>
            </div>
            <p className="font-bold text-on-surface text-base">김철수</p>
            <p className="text-xs text-on-surface-variant mt-0.5">일반 시민</p>
            <p className="text-xs text-primary mt-1">chulsoo@maumgyeol.kr</p>
            <div className="w-full h-px bg-outline-variant my-4" />
            <div className="w-full space-y-1">
              {tabs.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setActiveTab(t.key)}
                  className={`w-full flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-bold transition-colors text-left ${
                    activeTab === t.key
                      ? 'bg-primary/10 text-primary'
                      : 'text-on-surface-variant hover:bg-surface-container-low'
                  }`}
                >
                  <span className="material-symbols-outlined text-lg">{t.icon}</span>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* 계정 위험 구역 */}
          <div className="bg-white rounded-2xl border border-outline-variant p-5 shadow-sm">
            <p className="text-xs font-bold text-on-surface-variant mb-3">계정 관리</p>
            <button onClick={() => navigate('/login')} className="w-full flex items-center gap-2 text-sm text-error font-bold py-2 px-3 rounded-xl hover:bg-error-container/40 transition-colors">
              <span className="material-symbols-outlined text-lg">logout</span>
              로그아웃
            </button>
          </div>
        </div>

        {/* ── 오른쪽 콘텐츠 ── */}
        <div className="col-span-9">

          {/* 회원 정보 수정 */}
          {activeTab === 'profile' && (
            <div className="space-y-5">
              {/* 기본 정보 */}
              <div className="bg-white rounded-2xl border border-outline-variant shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-outline-variant bg-surface-container-low/40">
                  <p className="font-bold text-sm text-on-surface">기본 정보</p>
                  <p className="text-xs text-on-surface-variant mt-0.5">이름, 연락처, 이메일 정보를 수정합니다.</p>
                </div>
                <div className="p-6 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-on-surface-variant block mb-1.5">성명</label>
                      <div className="relative">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">person</span>
                        <input defaultValue="김철수"
                          className="w-full h-11 pl-10 pr-4 rounded-xl border border-outline-variant focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm" />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-on-surface-variant block mb-1.5">전화번호</label>
                      <div className="relative">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">phone</span>
                        <input defaultValue="010-1234-5678"
                          className="w-full h-11 pl-10 pr-4 rounded-xl border border-outline-variant focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm" />
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-on-surface-variant block mb-1.5">이메일 주소</label>
                    <div className="relative">
                      <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">mail</span>
                      <input defaultValue="chulsoo@maumgyeol.kr"
                        className="w-full h-11 pl-10 pr-4 rounded-xl border border-outline-variant focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm" />
                    </div>
                  </div>
                  <div className="flex justify-end pt-1">
                    <button className="bg-primary text-white text-sm font-bold px-6 py-2.5 rounded-xl hover:brightness-95 transition-all">
                      정보 저장
                    </button>
                  </div>
                </div>
              </div>

              {/* 비밀번호 변경 */}
              <div className="bg-white rounded-2xl border border-outline-variant shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-outline-variant bg-surface-container-low/40">
                  <p className="font-bold text-sm text-on-surface">비밀번호 변경</p>
                  <p className="text-xs text-on-surface-variant mt-0.5">보안을 위해 주기적으로 비밀번호를 변경해 주세요.</p>
                </div>
                <div className="p-6 space-y-4">
                  <div>
                    <label className="text-xs font-bold text-on-surface-variant block mb-1.5">현재 비밀번호</label>
                    <div className="relative">
                      <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">lock</span>
                      <input type="password" placeholder="현재 비밀번호 입력"
                        className="w-full h-11 pl-10 pr-4 rounded-xl border border-outline-variant focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-on-surface-variant block mb-1.5">새 비밀번호</label>
                      <div className="relative">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">lock_reset</span>
                        <input type="password" placeholder="새 비밀번호 입력"
                          className="w-full h-11 pl-10 pr-4 rounded-xl border border-outline-variant focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm" />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-on-surface-variant block mb-1.5">새 비밀번호 확인</label>
                      <div className="relative">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">lock_reset</span>
                        <input type="password" placeholder="새 비밀번호 재입력"
                          className="w-full h-11 pl-10 pr-4 rounded-xl border border-outline-variant focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm" />
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end pt-1">
                    <button className="bg-primary text-white text-sm font-bold px-6 py-2.5 rounded-xl hover:brightness-95 transition-all">
                      비밀번호 변경
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 알림 설정 */}
          {activeTab === 'notification' && (
            <div className="space-y-5">
              {/* 알림 채널 */}
              <div className="bg-white rounded-2xl border border-outline-variant shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-outline-variant bg-surface-container-low/40">
                  <p className="font-bold text-sm text-on-surface">알림 채널 설정</p>
                  <p className="text-xs text-on-surface-variant mt-0.5">민원 알림을 받을 채널을 선택하세요.</p>
                </div>
                <div className="divide-y divide-outline-variant/50">
                  {[
                    { label: '이메일 알림',     desc: '민원 처리 상태 및 공식 답변 수신', icon: 'mail',          color: 'bg-primary/10 text-primary' },
                    { label: '문자 알림 (SMS)', desc: '긴급 공지 및 본인 인증 코드 전송', icon: 'sms',           color: 'bg-amber-50 text-amber-600' },
                    { label: '앱 푸시 알림',    desc: '실시간 민원 상태 변경 알림',       icon: 'notifications', color: 'bg-emerald-50 text-emerald-600' },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between px-6 py-4 hover:bg-surface-container-low/30 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-xl ${item.color} flex items-center justify-center shrink-0`}>
                          <span className="material-symbols-outlined text-lg">{item.icon}</span>
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
              </div>

              {/* 알림 유형 */}
              <div className="bg-white rounded-2xl border border-outline-variant shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-outline-variant bg-surface-container-low/40">
                  <p className="font-bold text-sm text-on-surface">알림 유형 설정</p>
                  <p className="text-xs text-on-surface-variant mt-0.5">받고 싶은 알림 유형을 선택하세요.</p>
                </div>
                <div className="divide-y divide-outline-variant/50">
                  {[
                    { label: '민원 접수 확인',   desc: '민원이 정상 접수되었을 때',             icon: 'task_alt' },
                    { label: '담당자 배정',       desc: '민원 담당자가 배정되었을 때',           icon: 'assignment_ind' },
                    { label: '처리 상태 변경',   desc: '민원 처리 단계가 변경되었을 때',        icon: 'sync' },
                    { label: '답변 완료',         desc: '민원에 대한 공식 답변이 등록되었을 때', icon: 'mark_email_read' },
                    { label: '공지 및 이벤트',   desc: '서비스 공지 및 이벤트 안내',            icon: 'campaign' },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between px-6 py-4 hover:bg-surface-container-low/30 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-surface-container flex items-center justify-center shrink-0">
                          <span className="material-symbols-outlined text-on-surface-variant text-lg">{item.icon}</span>
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
                <div className="px-6 py-4 border-t border-outline-variant flex justify-end bg-surface-container-low/30">
                  <button className="bg-primary text-white text-sm font-bold px-6 py-2.5 rounded-xl hover:brightness-95 transition-all">
                    설정 저장
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </CitizenLayout>
  );
}

export default Settings;
