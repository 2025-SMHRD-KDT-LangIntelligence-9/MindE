import React from "react";
import "./Home.css";

function Home() {
  return (
    <div className="home-container">
      {/* GNB (Header) */}
      <header className="header">
        <div className="container" style={{ display: "flex", width: "100%", justifyContent: "space-between", alignItems: "center" }}>
          <div className="logo-area" onClick={() => window.location.reload()}>
            <div className="logo-icon">
              {/* Logo SVG Icon - Wave & Heart concept */}
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#5592ff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
              </svg>
            </div>
            <span className="logo-text">마음결</span>
          </div>
          
          <div className="nav-actions">
            <button className="btn-text">로그인</button>
            <button className="btn-primary-sm">회원가입</button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="hero-section">
        <div className="container hero-grid">
          <div className="hero-content">
            <div className="badge">
              {/* Shield/Check Icon */}
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              <span>시민을 위한 따뜻한 혁신, 공감 행정</span>
            </div>
            
            <h1 className="hero-title">
              기관과 시민의 마음을<br />
              <span>공감</span>으로 잇는 '마음결'
            </h1>
            
            <p className="hero-desc">
              마음결은 AI 기반 정밀 분석을 통해 시민의 고충을 깊이 이해하고, 
              기관이 진심 어린 행정으로 응답할 수 있도록 돕습니다.
            </p>
            
            <button className="btn-hero">
              <span>민원 신청하기</span>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </button>
          </div>

          <div className="hero-visual">
            <div className="mockup-img-wrapper">
              <img 
                src="/hero_mockup.png" 
                alt="마음결 관리자 대시보드 3D 일러스트" 
                className="mockup-img"
              />
            </div>
            
            {/* Testimonial Floating Card */}
            <div className="testimonial-card">
              <p className="testimonial-quote">
                "단순한 답변이 아닌, 제 상황을 깊이 고려한 따뜻한 응답에 감동했습니다."
              </p>
              <p className="testimonial-author">— 시민 김OO 님</p>
            </div>
          </div>
        </div>
      </section>

      {/* Process Flow Section */}
      <section className="flow-section">
        <div className="container">
          <div className="section-header">
            <h2 className="section-title">마음결의 민원 처리 흐름</h2>
            <p className="section-subtitle">
              시민의 목소리가 행정에 닿는 '결'을 디자인하여, 
              모든 단계에서 지지와 신뢰를 느낄 수 있는 프로세스를 제공합니다.
            </p>
          </div>

          <div className="flow-grid">
            {/* Step 1 */}
            <div className="flow-card">
              <div className="card-icon-wrapper">
                {/* Paper/Write Icon */}
                <svg className="card-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                </svg>
              </div>
              <h3 className="card-title">1. 마음을 전하는 접수</h3>
              <p className="card-desc">
                격식에 얽매이지 않고 편안하게 고민을 남겨주세요. 
                누구나 쉽게 이용할 수 있는 인터페이스를 지향합니다.
              </p>
            </div>

            {/* Step 2 - Highlighted */}
            <div className="flow-card active">
              <div className="card-icon-wrapper">
                {/* Brain/AI Gear Icon */}
                <svg className="card-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.44 2.5 2.5 0 0 1 0-3.12 3 3 0 0 1 0-4.88 2.5 2.5 0 0 1 0-3.12A2.5 2.5 0 0 1 9.5 2z" />
                  <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.44 2.5 2.5 0 0 0 0-3.12 3 3 0 0 0 0-4.88 2.5 2.5 0 0 0 0-3.12A2.5 2.5 0 0 0 14.5 2z" />
                </svg>
              </div>
              <h3 className="card-title">2. 결 AI의 정밀 분석</h3>
              <p className="card-desc">
                인공지능이 민원의 기술적 요건은 물론 감정의 시급성까지 분석하여 
                가장 적합한 담당자에게 연결합니다.
              </p>
            </div>

            {/* Step 3 */}
            <div className="flow-card">
              <div className="card-icon-wrapper">
                {/* Hand Holding Heart Icon */}
                <svg className="card-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="22" />
                </svg>
              </div>
              <h3 className="card-title">3. 공감 어린 답변</h3>
              <p className="card-desc">
                문제 해결은 물론, 시민의 마음까지 어루만지는 
                사려 깊은 답변을 통해 신뢰 행정을 실현합니다.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="container footer-grid">
          <div className="footer-info">
            <div className="footer-logo">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#5592ff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
              </svg>
              <span className="footer-logo-text">마음결</span>
            </div>
            <p className="footer-desc">
              혁신을 통한 공감 행정의 실현. 우리는 시민과 기관 사이의 보이지 않는 벽을 허눕니다.
            </p>
          </div>

          <div className="footer-links-col">
            <h4 className="footer-col-title">관련 정보</h4>
            <ul className="footer-links">
              <li><a href="#privacy" className="footer-link">개인정보 처리방침</a></li>
              <li><a href="#terms" className="footer-link">이용약관</a></li>
              <li><a href="#support" className="footer-link">고객 지원 센터</a></li>
            </ul>
          </div>

          <div className="footer-links-col">
            <h4 className="footer-col-title">플랫폼</h4>
            <ul className="footer-links">
              <li><a href="#about" className="footer-link">서비스 소개</a></li>
              <li><a href="#security" className="footer-link">보안 및 신뢰</a></li>
              <li><a href="#faq" className="footer-link">자주 묻는 질문</a></li>
            </ul>
          </div>
        </div>

        <div className="container footer-bottom">
          <p className="copyright">
            © 2024 마음결(Maeumgyeol). All rights reserved. 시민을 향한 따뜻한 마음.
          </p>
          
          <div className="footer-socials">
            {/* Globe SVG */}
            <span className="social-icon">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
            </span>
            {/* Users SVG */}
            <span className="social-icon">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </span>
            {/* Hub SVG */}
            <span className="social-icon">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default Home;
