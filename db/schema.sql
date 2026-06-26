-- ===== 마음이 민원 챗봇 DB 스키마 =====
-- PostgreSQL + pgvector

CREATE EXTENSION IF NOT EXISTS vector;

-- categories
CREATE TABLE categories (
    category_id BIGINT NOT NULL,
    name VARCHAR(50) NOT NULL,
    PRIMARY KEY (category_id)
);

-- departments
CREATE TABLE departments (
    department_id BIGINT NOT NULL,
    name VARCHAR(100) NOT NULL,
    contact_email VARCHAR(100),
    contact_phone VARCHAR(20),
    description TEXT,
    PRIMARY KEY (department_id)
);

-- category_department_mapping
CREATE TABLE category_department_mapping (
    mapping_id BIGINT NOT NULL,
    category_id BIGINT NOT NULL,
    department_id BIGINT NOT NULL,
    priority SMALLINT NOT NULL DEFAULT 1,
    PRIMARY KEY (mapping_id),
    FOREIGN KEY (category_id) REFERENCES categories(category_id),
    FOREIGN KEY (department_id) REFERENCES departments(department_id)
);

-- urgency_keywords
CREATE TABLE urgency_keywords (
    keyword_id BIGINT NOT NULL,
    keyword VARCHAR(50) NOT NULL,
    category_id BIGINT,
    weight NUMERIC(3,2) NOT NULL,
    PRIMARY KEY (keyword_id),
    FOREIGN KEY (category_id) REFERENCES categories(category_id)
);

-- users
CREATE TABLE users (
    user_id BIGINT NOT NULL,
    name VARCHAR(50) NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(100) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    user_type VARCHAR(20) NOT NULL,
    notification_enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id)
);

-- complaint_clusters
CREATE TABLE complaint_clusters (
    cluster_id BIGINT NOT NULL,
    representative_content TEXT,
    complaint_count INTEGER NOT NULL DEFAULT 1,
    first_seen_at TIMESTAMP NOT NULL DEFAULT now(),
    last_seen_at TIMESTAMP NOT NULL DEFAULT now(),
    PRIMARY KEY (cluster_id)
);

-- complaints
CREATE TABLE complaints (
    complaint_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    category_id BIGINT,
    assigned_department_id BIGINT,
    cluster_id BIGINT,
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    urgency_score NUMERIC(4,3) NOT NULL DEFAULT 0,
    duplicate_count INTEGER NOT NULL DEFAULT 1,
    status VARCHAR(20) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    PRIMARY KEY (complaint_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id),
    FOREIGN KEY (category_id) REFERENCES categories(category_id),
    FOREIGN KEY (assigned_department_id) REFERENCES departments(department_id),
    FOREIGN KEY (cluster_id) REFERENCES complaint_clusters(cluster_id)
);

-- complaint_responses
CREATE TABLE complaint_responses (
    response_id BIGINT NOT NULL,
    complaint_id BIGINT NOT NULL,
    content TEXT NOT NULL,
    referenced_docs JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    PRIMARY KEY (response_id),
    FOREIGN KEY (complaint_id) REFERENCES complaints(complaint_id)
);

-- complaint_attachments
CREATE TABLE complaint_attachments (
    attachment_id BIGINT NOT NULL,
    complaint_id BIGINT NOT NULL,
    file_url TEXT NOT NULL,
    file_type VARCHAR(20) NOT NULL,
    original_filename VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    PRIMARY KEY (attachment_id),
    FOREIGN KEY (complaint_id) REFERENCES complaints(complaint_id)
);

-- complaint_status_history
CREATE TABLE complaint_status_history (
    history_id BIGINT NOT NULL,
    complaint_id BIGINT NOT NULL,
    status VARCHAR(20) NOT NULL,
    changed_at TIMESTAMP NOT NULL DEFAULT now(),
    changed_by BIGINT,
    note TEXT,
    PRIMARY KEY (history_id),
    FOREIGN KEY (complaint_id) REFERENCES complaints(complaint_id),
    FOREIGN KEY (changed_by) REFERENCES users(user_id)
);

-- notifications
CREATE TABLE notifications (
    notification_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    complaint_id BIGINT,
    channel VARCHAR(10) NOT NULL,
    message TEXT NOT NULL,
    sent_at TIMESTAMP NOT NULL DEFAULT now(),
    status VARCHAR(10) NOT NULL,
    PRIMARY KEY (notification_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id),
    FOREIGN KEY (complaint_id) REFERENCES complaints(complaint_id)
);

-- rag_documents
CREATE TABLE rag_documents (
    document_id BIGINT NOT NULL,
    title VARCHAR(200),
    content TEXT NOT NULL,
    category_id BIGINT,
    embedding vector(768),
    source_type VARCHAR(20),
    PRIMARY KEY (document_id),
    FOREIGN KEY (category_id) REFERENCES categories(category_id)
);

-- ===== 시드 데이터 =====

-- 11 카테고리
INSERT INTO categories (category_id, name) VALUES (1, '교통') ON CONFLICT DO NOTHING;
INSERT INTO categories (category_id, name) VALUES (2, '건축') ON CONFLICT DO NOTHING;
INSERT INTO categories (category_id, name) VALUES (3, '행정') ON CONFLICT DO NOTHING;
INSERT INTO categories (category_id, name) VALUES (4, '보건위생') ON CONFLICT DO NOTHING;
INSERT INTO categories (category_id, name) VALUES (5, '환경') ON CONFLICT DO NOTHING;
INSERT INTO categories (category_id, name) VALUES (6, '문화_여가') ON CONFLICT DO NOTHING;
INSERT INTO categories (category_id, name) VALUES (7, '농축산') ON CONFLICT DO NOTHING;
INSERT INTO categories (category_id, name) VALUES (8, '복지') ON CONFLICT DO NOTHING;
INSERT INTO categories (category_id, name) VALUES (9, '세무') ON CONFLICT DO NOTHING;
INSERT INTO categories (category_id, name) VALUES (10, '상하수도') ON CONFLICT DO NOTHING;
INSERT INTO categories (category_id, name) VALUES (11, '경제') ON CONFLICT DO NOTHING;

-- 39 부서 (description 포함)
INSERT INTO departments (department_id, name, contact_email, contact_phone, description) VALUES (1, '교통행정과', NULL, '061-286-7450', '교통행정과 업무 총괄; 교통기획팀 업무 총괄; 시외버스 인허가, 버스 재정지원; 택시, 교통약자 이동 지원; 과 서무·예산, 충무계획, K-패스; 도시형,농촌형 교통모델, 벽지노선; 교통관리팀 업무 총괄; 교통안전 시행계획 수립; 자동차 관리, 건설기계 동원, 주차장; 물류정책팀 업무 총괄; 물류기본계획, 교통영향평가; 화물자동차 공영차고지') ON CONFLICT DO NOTHING;
INSERT INTO departments (department_id, name, contact_email, contact_phone, description) VALUES (2, '도로정책과', NULL, '061-286-7410', '도로정책과 업무 전반; 도로계획 업무 전반; 국지도 건설공사 총괄; SOC 예산확보 및 협의, 연륙연도교사업; 대도시권 광역도로, 국지도 건설공사 추진; 과서무, 국지도 건설공사 추진; 도로시설 업무 전반; 지방도 중장기 계획; 지방도 노선조정; 지방도 예산 및 관급자재; 연결허가, 비관리청 허가, 수해대책, 시설물 관리; 철도 업무 전반; 철도업무 추진; 공항업무 추진; 공항업무 지원; 철도업무 지원') ON CONFLICT DO NOTHING;
INSERT INTO departments (department_id, name, contact_email, contact_phone, description) VALUES (3, '건축개발과', NULL, '061-286-7710', '건축개발과 업무 총괄; 주거복지팀 업무 전반; 전남형 만원주택, 주거정책심의위원회 운용, 
청년 공공임대주택 건립사업추진; 빈집정비 사업, 한옥사업 등; 과 예산 업무, 물품관리, 보안업무 등; 공공임대주택 업무, 공동주택관리규약 , 소규모공동주택 보수지원  , 주택 건설 및 대지조성사업 계획 승인; 농어촌주택개량사업, 새꿈도시 조성사업 , 소규모지역개발사업; 주택관리사자격증 발급,  장애인주택개조사업, 청년월세, 주거급여, 공동주택 미분양 등; 건축관리 업무 전반; 건축법 관련 질의, 건축 위원회 운영, 건축허가 사전승인 등; , 공공건축물 그린리모델링사업,  건축사징계위원회 운영 등; 건축행정시스템 운영, 기계설비성능점검업 등록, 건축사 업무신고 등; 공공건축 업무 전반, 공공건축지원센터 설립 및 운영에 관한 사항; 건축정책위원회 구성 및 운영, 도 발주 공공건축사업 추진, 공공건축지원센터 
설립 및 운영 등; 공공건축 심의위원회 구성 및 운영, 도 발주 공공건축사업 추진, 공공') ON CONFLICT DO NOTHING;
INSERT INTO departments (department_id, name, contact_email, contact_phone, description) VALUES (4, '토지관리과', NULL, '061-286-7610', '토지관리과 업무 전반; 토지관리업무 전반; 부동산거래신고 통계; 개별공시지가, 토지거래허가구역; 부동산 중개업, 부동산개발업, 외국인토지 관리; 서무, 예산, 개발부담금; 지적 업무 전반; 지적측량적부심사, 지적측량 표본검사, 지적측량 관련 민원, 지적확정측량 검사-경지정리, 산업단지, 항만물류시설; 토지이동 업무, 지적측량 경진대회, 지적확정측량 검사-체육시설, 택지개발, 도로, 철도; 소규모 미등록토지, 연속지적도 정비사업, GNSS 상시관측소 운영, 일반측량업, 지적확정측량 검사-신규등록, 관광단지, 공원; 조상땅 찾기, 지적정보제공, 지적통계업무, 지적, 공공측량업, 지적확정측량 검사-아파트, 학교, 기타; 공간정보 업무 전반; 도로명주소; 공간정보 업무, 지하시설물; 무인비행기(드론) 운영; 공간정보시스템 운영 및 관리, 주소정보 기본도 관리, 국가지점번호 부여 및 시설물 관리, 사물주소; 지적재조사 업무 전반; 지적재조사 예산 운용, 지적재조사와 도시재생뉴딜사업 연계, 지') ON CONFLICT DO NOTHING;
INSERT INTO departments (department_id, name, contact_email, contact_phone, description) VALUES (5, '자치행정과', NULL, '061-286-3510', '자치행정과 업무 총괄; 행정 및 주민자치업무 총괄; 국.도정 주요시책 추진, 도민과의 대화, 국정감사 및 도의회 관련업무, 선거 관련 업무, 주민투표,주민소환제 업무, 시장군수 권역별, 상생협력간담회; 김대중 평화회의, 김대중-만델라 평화공원 조성사업 등, 도지사 마을좌담회, 시,군민의 날 행사지원, 지방자치단체 명칭, 위치, 구역 조정 및 행정구역 개편 총괄; 지역 여론동향, 집단민원 동향, 선거동향 파악 및 관리, 시장군수협의회, 명절 종합대책 추진, 갈등 및 도 분쟁조정위원회; 중앙지방자치단체 정책협의회, 도시군 부단체장 회의, 현장행정 우수 읍면동 선정, 국민통합위원회 업무; 주민자치회 및 주민자치센터, 주민등록, 새마을운동단체, 이통장협의회, 대한적십자사, 행정공제회; 과 일반 및 예산서무, 행정사, 반상회, 숨은 의인 및 선행자 표창, 지방행정의 달인 발굴; 조직관리업무 전반; 도 기구·정원 관리, 조직개편, 기준인건비, 사무량조사 및 조직진단 등; 소방 기구 및 인력 현') ON CONFLICT DO NOTHING;
INSERT INTO departments (department_id, name, contact_email, contact_phone, description) VALUES (6, '총무과', NULL, '061-286-3310', '자치행정국 업무 총괄; 총무과 업무 전반; 총무팀 업무 전반; 국 소관 주요시책, 조직문화 개선 시책 추진, 도의회 및 국회 대응; 정례조회 운영, 도민의 날 기념행사, 직원 한마음 체육행사; 주요 행사 내외빈 영접 의전, 도정 주요 행사 컨설팅; 국 서무, 업무추진비 총괄, 국 소관 정부합동평가 관리; 정책회의 등 국 주요 현안자료 작성, 적극행정 및 혁신·협업행정 전반; 과 서무, 초과근무, 청사방호 및 청원경찰 관리, 출입관리시스템, 행복주차장; 복무 관리, 보안업무 및 보안감사, 공무국외출장, 충무계획·을지연습 총괄; 일정관리, 출입관리시스템 관리 지원; 부속실 업무; 인사업무 전반; 임용, 승진, 개방형 직위, 인사혁신 및 제도개선; 인사고충, 인사교류, 전문직위, 전입, 6급 이하 전보인사 등; 휴직복직, 5급 교육, 수습평가, 포상업무, 시간선택제, 청원경찰 인사; 공무원 인사통계, 인사기록카드 관리, 제증명, 겸직허가; 연봉, 호봉, 대우, 공무원 수당, 의원면직, 명') ON CONFLICT DO NOTHING;
INSERT INTO departments (department_id, name, contact_email, contact_phone, description) VALUES (7, '식품의약과', NULL, '061-286-5750', '식품의약과 업무 총괄; 식품안전 업무 전반; 도의회 업무, 식중독 관련 업무, 식품·공중위생 협회단체 관리 등; 식품위생업소 관리, 식품안전사고 및 부정불량식품 대응 등; 식품 수거검사, 식품의약품 충무, 과 예산서무; 과 일반서무; 음식문화 업무 전반; K-Food 레시피 개발, 음식문화개선, 남도음식거리 조성; 식품진흥기금, 어린이,사회복지급식관리지원센터 운영, 어린이식생활 안전관리, 어린이 기호식품 안전관리; 공중위생 관리, 위생용품 관리, 음식점 3대 청결운동 추진; 의료관리업무 전반; 의료법인, 외국인 환자 유치 및 지원, 의료 관련 협회 단체 관리; 의료기관 개설, 의료기관 지도·관리에 관한 사항 등; 의약품, 마약류, 의료기기, 화장품, 진폐장해인, 장기이식; 응급의료업무 전반; 응급의료기관, 재난응급의료, 응급환자이송업; 응급의료 전용헬기, 취약지 응급의료기관 지원, 통합의학박람회; 헌혈, 마음건강치유센터 운영지원, 취약계층 마음건강치유프로그램 운영, 한의약 산업 육성') ON CONFLICT DO NOTHING;
INSERT INTO departments (department_id, name, contact_email, contact_phone, description) VALUES (8, '감염병관리과', NULL, '061-286-5360', '감염병관리과 업무 총괄; 감염병정책팀 업무 전반; 감염병 예방관리 기본계획 및 재난 위기대응, 감염병관리지원단 운영 등; 과 일반서무 및 예산에 관한 사항, BSC 성과관리 등; 감염병예방팀 업무 전반; 법정감염병 1급 예방관리, 코로나19 방역물품 관리 등; 법정감염병 4급 예방관리, 국가ㆍ선택 예방접종 등; 국가예방접종 이상반응 피해보상 및 조사, 성매개감염병, 방역 등; 질병보건통합관리시스템 관리 등; 역학조사팀 업무 전반; 법정감염병 2급 예방관리, 시군 역학조사관 관리, 코로나19 발생 현황 관리 등; 결핵예방관리사업, 해외유입 신종 감염병, 감염병 격리입원치료비 지원 등; 결핵관리시스템 운영관리, 결핵 역학조사 지원; 감염병 역학조사; 결핵 환자관리, 결핵 역학조사 지원; 감염병관리지원계획 수립 및 추진 등; 생물테러감염병 훈련 지원 등; 일일감염병 모니터링, 감염병 교육자료 제작 등; 도 내 감염병 발생 동향 감시 분석; 일일감염병 모니터링, 서무 등') ON CONFLICT DO NOTHING;
INSERT INTO departments (department_id, name, contact_email, contact_phone, description) VALUES (9, '환경정책과', NULL, '061-286-7010', '환경산림국 업무 총괄; 환경정책과 업무 총괄; 환경정책팀 업무 전반; 자연생태 업무 전반; 자원순환팀 업무 전반; 생활환경팀 업무 전반; 환경조사팀 업무 전반; 환경민원팀 업무 전반

[상세 업무]
환경산림국 업무 총괄; 환경정책과 업무 총괄; 환경정책팀 업무 전반; 환경영향평가, 환경정책위원회; 국차석 업무, 환경교육; 국서무 업무; 과 서무, 환경개선부담금, 녹색제품; 자연생태 업무 전반; 자연공원지정, 국가지질공원 인증 관련; 야생동물 보호 및 관리 등; 자원순환팀 업무 전반; 생활폐기물 처리시설, 폐기물 처분부담금; 재활용·음식물 폐기물처리시설; 농촌·영농·사업장·건설 폐기물; 생활환경팀 업무 전반; 환경산업, 환경보건; 소음·진동, 다중이용시설 실내공기질; 환경조사팀 업무 전반; 여수산단 민관 협력 거버넌스; 환경전문 공사업, 측정대행업 - 동부권 10개 시군; 환경민원팀 업무 전반; 대기, 수질 배출시설관련 사무 - 서부권 12개 시·군; 환경전문 공사업, 측정대행업 - ') ON CONFLICT DO NOTHING;
INSERT INTO departments (department_id, name, contact_email, contact_phone, description) VALUES (10, '기후대기과', NULL, '061-286-7910', '기후대기과 업무 총괄; 기후변화정책팀 업무 전반; 대기환경팀 업무 전반; 대기관리팀 업무 전반; COP33유치팀 업무 전반

[상세 업무]
기후대기과 업무 총괄; 기후변화정책팀 업무 전반; 온실가스 감축인지예산제, 탄소중립도시 조성; 탄소중립 정책 수립, 온실가스 감축사업; 기후위기 취약계층지역 지원사업, 과서무; 탄소중립포인트제; 대기환경팀 업무 전반; 미세먼지 계절관리제, 전기차 충전인프라 구축 등; 친환경자동차 보급사업, 운행차 배출가스 저감사업 등; 대기관리팀 업무 전반; 대기오염물질 배출사업장 관리 등; 소규모사업장 방지시설, 배출부과금 업무 등; COP33유치팀 업무 전반; COP33 남해안 남중권 유치 추진') ON CONFLICT DO NOTHING;
INSERT INTO departments (department_id, name, contact_email, contact_phone, description) VALUES (11, '관광과', NULL, '061-286-5210', '관광체육국 업무전반; 관광과 업무 전반; 관광정책팀 업무 전반; 국 소관 행정 종합기획; 섬 방문의 해, 관광협회 운영 지원 등; 과 서무, 관광진흥기금; 부속실 관리 등 비서업무; 관광마케팅팀 업무 전반; 관광객 유치 마케팅 종합계획 수립 및 운영, 국내 관광 마케팅; 국내 관광 마케팅, 남도한바퀴 운영; 온라인 홍보마케팅, 남도여행길잡이, 국내외 SNS 매체 활용 관광 홍보; 융합관광팀 업무 전반; 해외 관광 마케팅 등; 전남관광플랫폼 운영 등; 문화관광해설사, 워케이션 운영 등; 글로벌축제T/F팀 업무 전반; 도 대표축제 지원, 남도음식문화큰잔치; 명량대첩축제 등') ON CONFLICT DO NOTHING;
INSERT INTO departments (department_id, name, contact_email, contact_phone, description) VALUES (12, '스포츠산업과', NULL, '061-286-5510', '스포츠산업과 업무 전반; 체육정책팀 업무 전반; 전남체육진흥협의회 운영, 도 체육회 운영 및 지원, 전국 및 전남 체육대회 지원, LPGA 대회 개최 지원; 국제경기대회, 프로대회 유치 및 지원, 전남바둑 활성화 시책 추진, 직장운동경기부 운영 지원, 비영리법인 설립 허가 및 관리; 과 서무, 장애인체육회 운영 및 지원, 장애인 전문 및 생활체육지도자 배치 관리, 장애인 생활체육대회 개최 지원; 도청 직장운동경기부 관리, 지출; 체육시설팀 업무 전반; 도 종합체육시설 개보수사업, 등록체육시설업& #40;골프장 등& #41; 사업계획 승인·변경 등록 및 안전관리 감독 등; 도, 시군 공공민간 체육시설 안전관리 추진, 근린생활형 소규모 지특사업 추진, 소규모 체육시설 도비 사업 추진; 생활체육팀 업무 전반; 유소년 체육 활성화, 스포츠강좌이용권 사업추진, 대한민국체육인재개발원 활성화, 문체부 생활체육 지원사업 추진; 전라남도생활체육대축전 지원, 전국생활체육대축전 참가 지원, 전남어르신생') ON CONFLICT DO NOTHING;
INSERT INTO departments (department_id, name, contact_email, contact_phone, description) VALUES (13, '농업정책과', NULL, '061-286-6210', '농축산식품국 업무 총괄; 농업정책과 업무 총괄; 농정기획 업무 전반; 농업정책개발 및 기획조정, 농어발전계획 수립 및 3농정책 총괄, 농산물 FTA 대응대책 수립,  농축산물 수입개방 확대 대책 수립·시행 등; 국 소관 행정의 종합기획 조성, 국회관련 사항 및 국정감사 수감 등; 국 일반서무, 정부종합평가, , 충무계획 수립 및 보안; 국·과 예산서무, 국가균형발전 특별회계 포괄보조사업 총괄, 국고지원현안사업 관리, 농축산식품사업 예산 신청; 과 일반서무, 농업계 학교 지원, 농촌 돌봄서비스지원 사업, 농촌 왕진버스; 농축산식품국장실 근무; 농촌인력지원팀 업무 전반; 농촌인력지원 대응 계획 수립, 계절근로자 도입, 농업근로자 기숙사 건립 지원; 농어촌진흥기금 관리 운영, 농업인 월급제 지원, 경관보전직불제, 농업경영 컨설팅, 농촌공동체회사 지원, 농업정책자금 이차보전 지원; 농촌체험 휴양마을 지원,  농어촌 공익수당 지원; 그린바이오 지원 업무 전반; 그린바이오 육성지구 유치·조성 ') ON CONFLICT DO NOTHING;
INSERT INTO departments (department_id, name, contact_email, contact_phone, description) VALUES (14, '축산정책과', NULL, '061-286-6510', '축산정책과 업무 총괄; 축산정책팀 업무 전반; AI축산 융복합밸리 조성, 국립축산과학원 축산자원개발부 이전 지원,  축산분야 신규시책 수립 및 시행, 환경친화형 축산 5개년 운용, 축협조합 및 축산단체 등 업무 협조, 선도농업인 육성관리 등; 한우산업 육성 및 한우개량, 한우 송아지브랜드 육성사업 추진, 으뜸한우 육성시설 지원, 한우 수정란 이식 지원, 축산기자재 종합 물류센터 지원, 한우 등록 지원 등; 축산분야 FTA 대응 및 수입개방대책 수립 추진, 축산 ICT 융복합 지원사업 추진, 가축개량 지원사업 추진, 축산재해 대책 수립 및 사후관리, 가축재해보험 가입비 지원 등; 녹색축산육성기금 조례 및 운용, 과 예산관리, 축사시설 현대화 사업 추진, 스마트 축산단지 조성사업 추진 등; 과 서무 업무, 축산법 운용, 축산관련 종사자교육 관리, 가축인공수정사 면허 관리, 가축통계 조사 및 축산통계 관리, 가축 인공수정사 활동 지원, 한우 자동 목걸림 장치 지원  등; 동물복지팀 업무 ') ON CONFLICT DO NOTHING;
INSERT INTO departments (department_id, name, contact_email, contact_phone, description) VALUES (15, '사회복지과', NULL, '061-286-5710', '보건복지국 업무 총괄; 사회복지과 업무 전반; 복지정책업무 전반; 복지정책 종합계획, 각종 시책 및 업무보고; 지역사회보장계획 연차별 시행계획 수립, 사회서비스원 운영 등; 국서무, 사회복지시설 총괄 관리 등; 과서무, 사회복지협의회 운영 지원 등; 보건복지국 부속실 업무; 생활지원업무 전반; 의료급여사업; 기초생활보장사업 등; 자활사업, 자산형성지원사업 등; 의료급여사례관리; 지역복지업무 전반; 우리동네 복지기동대 등; 읍면동 맞춤형 통합서비스 등; 지역자율형사회서비스투자사업 등; 보훈시행계획 수립 및 지원 총괄; 보훈단체 운영 및 지원; 노숙인시설 지원, 푸드뱅크마켓 지원') ON CONFLICT DO NOTHING;
INSERT INTO departments (department_id, name, contact_email, contact_phone, description) VALUES (16, '노인복지과', NULL, '061-286-5810', '노인복지과 업무 총괄; 노인정책팀 업무 전반; 노인복지 종합계획 수립 및 조정, 고령화 대책 시행·계획, 노인복지관련 법인관리, 도지사 공약·지시사항 총괄 관리, 도 의회 관련 업무, 도 노인회·노인회관 지원, 정부합동평가 총괄 관리, 기초연금 관리·운영, 노인의 날 운영 등 효행 장려 업무, 노인보호전문기관 및 학대피해노인쉼터 운영; 노인맞춤돌봄서비스 사업지원, 노인돌봄 거점수행기관 지원, 노인통합돌봄 사업 지원, 노인의료돌봄 통합지원 시범사업 추진; 경로당 운영 및 활성화, 경로당 냉난방비·양곡비 지원, 경로당 광역지원센터 설치·운영, 경로당 태양광 발전시설 설치사업, 경로당 공동생활의 집 설치 지원, 노인복지관 신축 및 운영지원, 노인교실 운영관리, 노인여가복지시설 설치 등 지원, 시니어합창단 운영지원; 응급안전안심서비스 사업, IOT 활용 건강안전알림서비스, 스마트 기술 확산 및 보급사업 추진,과 예산 및 회계에 관한 사항; 과 일반서무, 국회의원·도의원 요구자료, 균형성과관') ON CONFLICT DO NOTHING;
INSERT INTO departments (department_id, name, contact_email, contact_phone, description) VALUES (17, '장애인복지과', NULL, '286-5610', '장애인복지과 업무 전반; 장애인복지팀 업무 전반; 장애인단체 지원, 장애인복지위원회 운영, 전남장애인권익옹호기관 운영 등; 장애인의료비 지원, 장애인활동지원, 연금 등; 과서무, 여성장애인 지원 등; 장애인재활팀 업무 전반; 발달장애인 관련 업무 등; 장애인일자리 사업, 장애아가족 양육지원사업 추진 등; 장애인 이용지원센터 지원, 탈시설 자립 지원 등; 장애인시설팀 업무 전반; 장애인시설 관련 법인 설립허가 및 지도감독, 장애인 일자리 박람회 추진, 장애인 거주시설 운영 등; 도 장애인종합복지관 운영, 장애인거주시설 기능보강 사업추진 등') ON CONFLICT DO NOTHING;
INSERT INTO departments (department_id, name, contact_email, contact_phone, description) VALUES (18, '세정과', NULL, '061-286-3610', '세정과 업무 전반; 세정팀 업무 전반; 지방세정 기획, 세수추계, 세정평가; 지방세심의위원회 운영 및 조례; 도세, 이의신청; 통계,지방소비세; 일반서무, 예산; 세무조사팀 업무 전반; 세외수입 업무 전반; 세외수입, 기부심사, 도금고 관리, 채권; 국고보조금, 세외수입시스템; 체납징수 업무 전반; 지방세 체납징수 총괄,
고액상습체납자 명단공개, 출국금지; 납세편의시책, 과오납 환급, 과표') ON CONFLICT DO NOTHING;
INSERT INTO departments (department_id, name, contact_email, contact_phone, description) VALUES (19, '수자원관리과', NULL, '061-286-7110', '수자원관리과 업무총괄; 수계정책 업무 전반; 수자원 업무 전반; 먹는물 관리업무 전반; 하수관리 업무 전반

[상세 업무]
수자원관리과 업무총괄; 수계정책 업무 전반; 수계관리기금 운용, 주민지원사업 등; 산업단지 완충저류시설 설치 사업 추진 등; 수질오염 총량관리 기본계획 수립 추진 등; 영산강 클린호 선장; 영산강 클린호 기관장; 영산강 클린호 항해사; 영산강클린호 항해사; 수자원 업무 전반; 댐 주변지역 정비사업 및 주민지원사업 추진 등; 광역상수원 보호구역 관련 업무; 먹는물 관리업무 전반; 상수도 예산, 사업 인가 등; 상수도 시설물 등; 먹는샘물, 지하수, 토양 등; 하수관리 업무 전반') ON CONFLICT DO NOTHING;
INSERT INTO departments (department_id, name, contact_email, contact_phone, description) VALUES (20, '기반산업과', NULL, '061-286-3810', '전략산업국 업무 총괄; 기반산업과 업무 총괄; 산업정책 업무 총괄; 지역경제정책 수립 추진 등; 전남테크노파크 운영지원, 규제자유특구 지정 준비 등; 부속실 업무; 조선해양산업 업무 전반; 조선해양산업 육성사업 발굴, 조선산업 기반구축 등; 조선업 인력양성 추진 등; 조선업 인력양성 지원 등; 신소재이차전지팀 업무 총괄; 신소재 이차전지 산업육성 등; 사용후 배터리 산업 육성 등') ON CONFLICT DO NOTHING;
INSERT INTO departments (department_id, name, contact_email, contact_phone, description) VALUES (21, '일자리경제과', NULL, '061-286-5010', '일자리투자유치국 업무 총괄; 일자리경제과 업무 전반; 경제정책팀 업무 전반; 일자리창출팀 업무전반; 사회적경제팀 업무전반; 마을공동체팀 업무전반

[상세 업무]
061-286-5000; 061-286-5010; 061-286-5020; 061-286-5021; 061-286-5022; 061-286-5023; 061-286-5024; 061-286-5025; 061-286-5026; 061-286-5002; 061-286-5030; 061-286-5031; 061-286-5032; 061-286-5033; 061-286-5034; 061-286-5040; 061-286-5041; 061-286-5042; 061-286-5043; 061-286-5050; 061-286-5051; 061-286-5052; 일자리투자유치국 업무 총괄; 일자리경제과 업무 전반; 경제정책팀 업무 전반; 지역경제살리기 종합대책 추진, 시도경제협의회 및 지역경제협의회 운영관리, 지역경제 현안대응 협의체 운영, ') ON CONFLICT DO NOTHING;
INSERT INTO departments (department_id, name, contact_email, contact_phone, description) VALUES (22, '투자유치과', NULL, '061-286-5110', '투자유치과 업무 총괄; 투자기획팀 업무 총괄; 투자유치팀 업무 총괄; 외자유치팀 업무 총괄

[상세 업무]
061-286-5110; 061-286-5120; 061-286-5121; 061-286-5122; 061-286-5123; 061-286-5124; 061-286-5130; 061-286-5131; 061-286-5132; 061-286-5133; 061-286-5140; 061-286-5141; 061-286-5142; 투자유치과 업무 총괄; 투자기획팀 업무 총괄; 투자유치 종합계획 수립; 도내 투자기업 도비보조금 운영; 지방투자촉진보조금 지원; 투자유치팀 업무 총괄; 대면 투자협약 체결 추진; 서면 투자협약 체결 추진, 투자유치 설명회 및 간담회 개최 추진; 협약기업 사후관리; 외자유치팀 업무 총괄; 외국인 투자유치 종합계획 수립; 미주·유럽 지역 투자유치 활동 추진') ON CONFLICT DO NOTHING;
INSERT INTO departments (department_id, name, contact_email, contact_phone, description) VALUES (23, '중소벤처기업과', NULL, '061-286-3700', '중소벤처기업과 업무 전반; 중소기업 육성 업무 전반; 노동정책 업무 전반; 벤처창업 지원 업무 전반; 소상공인 업무 전반; 지역상권 업무 전반

[상세 업무]
061-286-3700; 061-286-3750; 061-286-3751; 061-286-3752; 061-286-3753; 061-286-3754; 061-286-3760; 061-286-3761; 061-286-3762; 061-286-3770; 061-286-3771; 061-286-3772; 061-286-3780; 061-286-3782; 061-286-3783; 061-286-3790; 061-286-3791; 061-286-3792; 061-286-3793; 중소벤처기업과 업무 전반; 중소기업 육성 업무 전반; 국회·의회 관련 업무, 중소기업육성 종합계획 수립·시행, 정부합동평가, 지역주도형 AI 대전환 사업 추진, 스마트공장 구축 및 지원 업무, 강소기업 육성 추진 등; 중소기업 지원 자금, 중소기업일자리경제진흥') ON CONFLICT DO NOTHING;
INSERT INTO departments (department_id, name, contact_email, contact_phone, description) VALUES (24, '산단개발과', NULL, '061-286-5150', '산단개발과 업무 총괄; 산단입지팀 업무 총괄; 산단조성팀 업무 총괄; 산단지원팀 업무 총괄

[상세 업무]
061-286-5150; 061-286-5160; 061-286-5161; 061-286-5162; 061-286-5163; 061-286-5170; 061-286-5171; 061-286-5172; 061-286-5173; 061-286-5680; 061-286-5681; 061-286-5682; 산단개발과 업무 총괄; 산단입지팀 업무 총괄; 산업단지 지정계획 수립; 산업입지 수급계획; 산단조성팀 업무 총괄; 산업단지 종합기획; 산업단지 지정 및 개발; 산단지원팀 업무 총괄; 산업단지 대개조; 농공단지 지원') ON CONFLICT DO NOTHING;
INSERT INTO departments (department_id, name, contact_email, contact_phone, description) VALUES (25, '문화예술과', NULL, '061-286-5410', '문화융성국 업무 총괄; 문화예술과 업무 총괄; 문화정책 업무 전반; 예술진흥 업무 전반; 남도문예 업무 전반

[상세 업무]
문화융성국 업무 총괄; 문화예술과 업무 총괄; 문화정책 업무 전반; 국 차석, 문화예술기본계획 수립, 전남문화재단 운영 지원, 문예진흥 기금사업, 메세나 협정관련, 문학박람회 및 문학관 업무; 통합문화이용권, 문화원 및 유림단체 지원, 종교·문화 시설 건립 및 프로그램 사업, 문화예술 법인 설립 허가·관리, 지역문화 활력 촉진 사업, 폐산업시설 문화재생 사업; 국 서무, 생활문화센터 조성 지원, 문화예술회관 건립 지원, 문화기반시설 운영 관리 총괄, 문화도시 지원; 과 서무, 문화가 있는 날 운영, 국어 진흥 업무, 지역문학진흥 및 문학단체 지원; 예술진흥 업무 전반; 영호남 상생협력 화합대축전, 도립국악단 운영 및 지원, 공연예술진흥 기본계획 수립, 전남민속예술 축제 개최, 국악분야 예술강사 지원, 명예예술인 지정 운영; 지역문화예술 지원·육성, 예술인 복지') ON CONFLICT DO NOTHING;
INSERT INTO departments (department_id, name, contact_email, contact_phone, description) VALUES (26, '문화자원과', NULL, '061-286-5310', '문화자원과 업무 총괄; 문화자원정책팀 업무 전반; 문화자원보존팀 업무 전반

[상세 업무]
문화자원과 업무 총괄; 문화자원정책팀 업무 전반; 마한업무 및 시책 국고 업무 등; 국가유산위원회"사적" 운영, 세계유산 등재"마한,갯벌", 국가유산산업; 전통사찰, 국가유산위원회"건축, 무형" 운영; 자연유산위원회 운영, 고인돌 공원 위탁운영; 문화자원보존팀 업무 전반; 문화유산 보존관리 시행계획 수립, 도지정유산 보수정비 사업; 국가 및 도 지정 유산 보수정비; 문화유산돌봄사업, 국가지정유산 재난안전 관리 등; 문화자원활용팀 업무 전반; 한국호남학진흥원 운영 등; 역사인문업무, 동학농민운동 등; 국가유산 활용사업, 무형유산 보호 육성') ON CONFLICT DO NOTHING;
INSERT INTO departments (department_id, name, contact_email, contact_phone, description) VALUES (27, '문화산업과', NULL, '061-286-5460', '문화산업과 업무 총괄; 문화산업팀 업무 총괄; 콘텐츠산업팀 업무 총괄; 경관디자인팀 업무 총괄; K-디즈니조성 T/F팀 업무 총괄

[상세 업무]
문화산업과 업무 총괄; 문화산업팀 업무 총괄; 남도영화제 추진, 전남영상위원회 운영 등; 공예산업 업무, 작은영화관 등; 지역서점인증, 찾아가는 영화관, 과 서무 등; 콘텐츠산업팀 업무 총괄; 문화콘텐츠 중장기 발전계획 수립, 시책사업 발굴 등; 전남정보문화산업진흥원 업무 전반, 콘텐츠 개발 지원사업 등; 문화콘텐츠 창업 및 기업 지원, 메타버스, 게임 및 이스포츠 등; 경관디자인팀 업무 총괄; 경관위원회 운영, 경관분야 공모사업 추진 등; 옥외광고물 업무 추진 등; 공공디자인 관련 업무 추진, 상품브랜드 디자인 개발 등; K-디즈니조성 T/F팀 업무 총괄; K-디즈니조성 업무 추진 등') ON CONFLICT DO NOTHING;
INSERT INTO departments (department_id, name, contact_email, contact_phone, description) VALUES (28, '남도의병역사박물관 개관준비단', NULL, '061-286-5310', '남도의병역사박물관개관준비단 업무 총괄; 남도의병역사박물관 건립팀 업무 전반; 남도의병역사박물관 학예전시팀 업무 전반

[상세 업무]
남도의병역사박물관개관준비단 업무 총괄; 남도의병역사박물관 건립팀 업무 전반; 남도의병역사박물관 건립공사 - 전기, 통신, 소방; 남도의병역사박물관 건립공사 - 건축, 토목; 남도의병역사박물관 개관 홍보; 남도의병역사박물관개관준비단 서무; 남도의병역사박물관 학예전시팀 업무 전반; 남도의병역사박물관 전시 영상 분야, 남도의병 선양사업 기본계획 수립; 남도의병역사박물관 전시 디자인, 교육 담당; 남도의병역사박물관 전시 유물 수집 및 관리') ON CONFLICT DO NOTHING;
INSERT INTO departments (department_id, name, contact_email, contact_phone, description) VALUES (29, '산림자원과', NULL, '061-286-7510', '산림자원과 업무 총괄; 산림정책팀 업무 전반; 산림자원팀 업무 전반; 산림보호팀 업무 전반; 산지관리팀 업무 전반

[상세 업무]
산림자원과 업무 총괄; 산림정책팀 업무 전반; 산림행정종합평가, 산림조합 지방이양사무 및 특화사업, 지역산림계획 수립시행, 산림경영계획 인가관리, 민관협력형 산림경영시범사업; 산림사업법인 등록관리, 나무병원 등록관리, 사유림 DB구축관리, 산림기본통계, 입목등록 및 등기, 지상권 말소, 산림분야 일자리; 과 서무, 예산; 산림자원팀 업무 전반; 조림사업, 임업진흥권역, 선도 산림경영단지, 한반도 평화의 숲, 5억그루 나무심기; 숲가꾸기, 칡덩굴제거, 나무은행 운영, 임업기계 장비보급, 산림사업 안전사고 예방 대책; 목재산업 활성화 계획 수립, 목재이용 촉진관리, 목재수확 점검관리, 벌채 부산물 수집이용, 미이용 바이오매스 관리, 양묘; 숲속의전남 만들기, 주민단체참여숲 조성; 산림보호팀 업무 전반; 산림병해충방제 종합계획 수립, 소나무재선충병 예찰 및 방') ON CONFLICT DO NOTHING;
INSERT INTO departments (department_id, name, contact_email, contact_phone, description) VALUES (30, '산림휴양과', NULL, '061-286-7560', '산림휴양과 업무 총괄; 산림경영팀 업무 전반; 정원산업팀 업무 전반; 산림생태관광팀 업무 전반

[상세 업무]
산림휴양과 업무 총괄; 산림경영팀 업무 전반; 임업인 단체, 도유림, 분재; 임업직불제, 과 일반 및 예산 서무; 임산물 유통기반 확충, 재해복구; 정원산업팀 업무 전반; 국가정원, 정원박람회, 민간정원; 국립난대수목원, 지방정원; 도시숲, 가로수; 녹색자금, 무궁화 동산; 산림생태관광팀 업무 전반; 임도, 숲길, 산림복지단지, 산림교육센터; 자연휴양림, 산림치유, 숲속아영장, 산림욕장, 산림레포츠; 숲해설, 유아숲교육, 산림문화자산') ON CONFLICT DO NOTHING;
INSERT INTO departments (department_id, name, contact_email, contact_phone, description) VALUES (31, '여순사건지원단', NULL, '061-286-7860', '여순사건지원단 업무 총괄; 기획운영팀 업무 총괄; 조사팀 업무 총괄

[상세 업무]
여순사건지원단 업무 총괄; 기획운영팀 업무 총괄; 여순사건 실무위원회 운영; 여순사건 역사왜곡 대응, 특별법 업무; 여순사건 추념식 개최; 비서 업무; 조사팀 업무 총괄; 여순사건 실무위원회 소위원회 운영; 여순사건 사실조사단 운영; 여순사건 신고·접수 및 사실조사; 여순사건 신고·접수 및 사실조사 지원') ON CONFLICT DO NOTHING;
INSERT INTO departments (department_id, name, contact_email, contact_phone, description) VALUES (32, '기획홍보담당관', NULL, '061-286-7810', '기획홍보담당 업무 총괄; 동부정책 업무 전반; 홍보업무 전반; 동부지역 민원업무 전반

[상세 업무]
기획홍보담당 업무 총괄; 동부정책 업무 전반; 주요업무보고, 본부 조직관리, 도정자문협의회; 본부 일반지출, 후생복지; 본부 및 예산 서무; 국 서무업무; 업무용 차량 및 일정 관리; 청사 방호 및 방문객 안내; 본부장 부속실; 국장 부속실; 동부지역본부 구내식당 식단관리, 식재료 발주 등; 홍보업무 전반; 동부지역본부 홍보업무 종합계획 수립, 신문사·인터넷 신문사업 변경·등록 등; 동부지역본부 LED 및 누리집 운영 등; 동부지역 민원업무 전반; 동부권 민원사무처리 및 민원제도발굴') ON CONFLICT DO NOTHING;
INSERT INTO departments (department_id, name, contact_email, contact_phone, description) VALUES (33, '소방행정과', NULL, '061-860-3820', '소방행정팀 업무 전반 (소방공무원 인사발령, 정원 및 계급관리, 전라남도의회 업무, 소방공무원 교육·훈련, 표창·행사); 소방인사팀 업무 전반 (소방공무원 인사발령, 교육·훈련, 표창); 소방예산팀 업무 전반 (소방예산 총괄 편성 및 운용, 일반회계 및 특별회계 재정 운영, 세입·세출외 현금 및 유가증권 출납, 연말정산 확정 및 환급·징수, 수당내역 관리); 소방장비팀 업무 전반 (소방청사 공사관리, 소방장비·물품 관리, 공사·용역·물품 계약, 국·공유재산관리, 이동정비반 운영, 차량 성능평가); 안전보건팀 업무 전반 (소방공무원 안전사고 방지대책 및 지도·감독, 보건 예방 대책, 공상·순직 처리, 복무제도·후생복지)

[상세 업무]
소방행정팀 업무 전반 (소방공무원 인사발령, 정원 및 계급관리, 전라남도의회 업무, 소방공무원 교육·훈련, 표창·행사); 기획, 의회; 국서무, 회의; 과서무, 복무; 소방인사팀 업무 전반 (소방공무원 인사발령, 교육·훈련, 표창); 징계, 인사; 호봉') ON CONFLICT DO NOTHING;
INSERT INTO departments (department_id, name, contact_email, contact_phone, description) VALUES (34, '화재대응과', NULL, '061-860-3920', '화재총괄팀 업무 전반 (화재진압대책, 소방 출동로 확보, 화재진압·개인보호장비 관리); 화재조사팀 업무 전반 (화재조사, 화재피해주민센터 운영, 소방용수시설 보강·관리); 현장지원팀 업무 전반 (의용소방대 업무, 재난관리자원 운영)

[상세 업무]
화재총괄팀 업무 전반 (화재진압대책, 소방 출동로 확보, 화재진압·개인보호장비 관리); 진압대책, 훈련; 경계근무, 충무; 과서무, 개인보호장비; 화재조사팀 업무 전반 (화재조사, 화재피해주민센터 운영, 소방용수시설 보강·관리); 조사운영, 용수; 화재감식, 통계; 용수, 민간자원; 현장지원팀 업무 전반 (의용소방대 업무, 재난관리자원 운영); 의소대 운영; 재난자원관리') ON CONFLICT DO NOTHING;
INSERT INTO departments (department_id, name, contact_email, contact_phone, description) VALUES (35, '구조구급과', NULL, '061-860-4020', '구조팀 업무 전반 (119구조대 편성·운영, 구조집행계획 및 정책협의회 운영, 긴급구조훈련 추진, 구조장비 확충·보강); 구급팀 업무 전반 (119구급대 편성·운영, 응급구조사 등 전문 구급대원 육성관리, 응급처치기구·장비·약품 구입·관리, 의료기관 응원협정 등 응급의료체계 구축); 긴급대응팀 업무 전반 (긴급구조 대응계획 수립, 도 긴급구조통제단 운영, 풍수·설해 등 소방대응활동 및 지원, 사고위험지역 발굴·개선사업, 구급지휘대 운영)

[상세 업무]
구조팀 업무 전반 (119구조대 편성·운영, 구조집행계획 및 정책협의회 운영, 긴급구조훈련 추진, 구조장비 확충·보강); 구조장비, 평가; 기술경연, RIT; 구조대책, 예산; 구급팀 업무 전반 (119구급대 편성·운영, 응급구조사 등 전문 구급대원 육성관리, 응급처치기구·장비·약품 구입·관리, 의료기관 응원협정 등 응급의료체계 구축); 구급장비사업; 응급의료기관; 긴급대응팀 업무 전반 (긴급구조 대응계획 수립, 도 긴급구조통제단 운') ON CONFLICT DO NOTHING;
INSERT INTO departments (department_id, name, contact_email, contact_phone, description) VALUES (36, '예방안전과', NULL, '061-860-4820', '예방기획팀 업무 전반 (예방안전대책 계획 수립, 소방시설 법령·성능위주설계·건축민원, 소방예방행정 통계 관리, 언론·공보·뉴미디어 소방홍보); 안전조사팀 업무 전반 (화재안전조사 및 긴급합동점검, 소방시설 자체점검 지도 및 감독, 위험물 안전관리, 소방시설 안전관리 콜센터 운영); 생활안전팀 업무 전반 (119생활안전순찰대 업무, 주택용 소방시설 보급, 소방안전교육, 안전문화행사)

[상세 업무]
예방기획팀 업무 전반 (예방안전대책 계획 수립, 소방시설 법령·성능위주설계·건축민원, 소방예방행정 통계 관리, 언론·공보·뉴미디어 소방홍보); 예방안전대책; 소방시설업, 성능; 과서무, 예방통계; 안전조사팀 업무 전반 (화재안전조사 및 긴급합동점검, 소방시설 자체점검 지도 및 감독, 위험물 안전관리, 소방시설 안전관리 콜센터 운영); 안전기획, 위험물; 안전조사, 다중; 안전조사, 자체점검; 생활안전팀 업무 전반 (119생활안전순찰대 업무, 주택용 소방시설 보급, 소방안전교육, 안전문화행사') ON CONFLICT DO NOTHING;
INSERT INTO departments (department_id, name, contact_email, contact_phone, description) VALUES (37, '소방감사담당관', NULL, '061-860-4120', '소방청렴팀 업무 전반 (청렴도 향상 종합대책, 공직자 재산등록·퇴직자 취업심사, 성과상여금·성과연봉, 소방관서 종합평가, 부패위험성 평가); 소방감사팀 업무 전반 (소방관서 자체감사, 감사결과 처분요구 조치사항 및 제도개선 관리, 일상감사 업무, 감사원 및 외부감사 지원, 사전 컨설팅·적극행정면책제도 운영); 소방법무조사팀 업무 전반 (소방공무원 징계처분·소청·소송·손실보상, 비위조사 및 익명신고시스템 운영, 진정·탄원·건의민원 관련조사, 특별사법경찰 업무)

[상세 업무]
소방청렴팀 업무 전반 (청렴도 향상 종합대책, 공직자 재산등록·퇴직자 취업심사, 성과상여금·성과연봉, 소방관서 종합평가, 부패위험성 평가); 법률지원, 성과급; 청렴, 소방평가; 과서무, 공직윤리; 소방감사팀 업무 전반 (소방관서 자체감사, 감사결과 처분요구 조치사항 및 제도개선 관리, 일상감사 업무, 감사원 및 외부감사 지원, 사전 컨설팅·적극행정면책제도 운영); 자체감사, 일상감사; 자체감사, 특정감사; 소방') ON CONFLICT DO NOTHING;
INSERT INTO departments (department_id, name, contact_email, contact_phone, description) VALUES (38, '소방교육과', NULL, '061-860-4720', '교육지원팀 업무 전반 (소방교육과 기본운영계획, 시설·장비 확충계획, 교육시설 신축 선행 절차, 시험 관리); 교육운영팀 업무 전반 (소방공무원 교육훈련, 신규임용자 교육과정 운영, 화재대응능력 평가, 사이버 교육과정, 교육생 생활지도·복무관리); 교육훈련팀 업무 전반 (화재대응능력 평가 및 현장실무교육 운영, 소방업무과학화 연구, 교수연구대회 운영, 화재·구조·구급·법령·시설분야 교육 및 연구)

[상세 업무]
교육지원팀 업무 전반 (소방교육과 기본운영계획, 시설·장비 확충계획, 교육시설 신축 선행 절차, 시험 관리); 교육행정, 공사; 청사, 계약; 예산, 장비; 과서무, 보안; 교육운영팀 업무 전반 (소방공무원 교육훈련, 신규임용자 교육과정 운영, 화재대응능력 평가, 사이버 교육과정, 교육생 생활지도·복무관리); 전문·특별교육; 신임·기본교육; 교육훈련팀 업무 전반 (화재대응능력 평가 및 현장실무교육 운영, 소방업무과학화 연구, 교수연구대회 운영, 화재·구조·구급·법령·시설분야') ON CONFLICT DO NOTHING;
INSERT INTO departments (department_id, name, contact_email, contact_phone, description) VALUES (39, '119종합상황실', NULL, '061-860-5040', '상황총괄팀 업무 전반 (119종합상황실 기본운영계획, 국민행복지표 소방정책, 상황관리팀 교육·평가, 구급상황관리센터 업무); 상황관리1팀 업무 전반 (화재·구조·구급·생활안전·재난재해 사고 상황 전파, 사고처리 분석·통계관리, 응급환자 안내·상담); 상황관리2팀 업무 전반; 상황관리3팀 업무 전반; 상황관리4팀 업무 전반; 소방정보통신팀 업무 전반 (전산·통신장비 관리·신기술 보급, 소방정보시스템 운영관리, 소방관서 홈페이지 관리·운영)

[상세 업무]
상황총괄팀 업무 전반 (119종합상황실 기본운영계획, 국민행복지표 소방정책, 상황관리팀 교육·평가, 구급상황관리센터 업무); 상황기획·관리; 예산·정보공개; 과서무, 통계; 상황관리1팀 업무 전반 (화재·구조·구급·생활안전·재난재해 사고 상황 전파, 사고처리 분석·통계관리, 응급환자 안내·상담); 상황관리 1팀 조정관; 상황관리 1팀; 상황관리2팀 업무 전반; 상황관리 2팀 조정관; 상황관리 2팀; 상황관리3팀 업무 전반; 상황관리 ') ON CONFLICT DO NOTHING;

-- 32 카테고리-부서 매핑
INSERT INTO category_department_mapping (mapping_id, category_id, department_id, priority) VALUES (1, 1, 2, 2) ON CONFLICT DO NOTHING;
INSERT INTO category_department_mapping (mapping_id, category_id, department_id, priority) VALUES (2, 1, 1, 1) ON CONFLICT DO NOTHING;
INSERT INTO category_department_mapping (mapping_id, category_id, department_id, priority) VALUES (3, 2, 4, 2) ON CONFLICT DO NOTHING;
INSERT INTO category_department_mapping (mapping_id, category_id, department_id, priority) VALUES (4, 2, 3, 1) ON CONFLICT DO NOTHING;
INSERT INTO category_department_mapping (mapping_id, category_id, department_id, priority) VALUES (5, 3, 6, 2) ON CONFLICT DO NOTHING;
INSERT INTO category_department_mapping (mapping_id, category_id, department_id, priority) VALUES (6, 3, 5, 1) ON CONFLICT DO NOTHING;
INSERT INTO category_department_mapping (mapping_id, category_id, department_id, priority) VALUES (7, 4, 8, 2) ON CONFLICT DO NOTHING;
INSERT INTO category_department_mapping (mapping_id, category_id, department_id, priority) VALUES (8, 4, 7, 1) ON CONFLICT DO NOTHING;
INSERT INTO category_department_mapping (mapping_id, category_id, department_id, priority) VALUES (9, 5, 10, 2) ON CONFLICT DO NOTHING;
INSERT INTO category_department_mapping (mapping_id, category_id, department_id, priority) VALUES (10, 5, 9, 1) ON CONFLICT DO NOTHING;
INSERT INTO category_department_mapping (mapping_id, category_id, department_id, priority) VALUES (11, 6, 12, 2) ON CONFLICT DO NOTHING;
INSERT INTO category_department_mapping (mapping_id, category_id, department_id, priority) VALUES (12, 6, 11, 1) ON CONFLICT DO NOTHING;
INSERT INTO category_department_mapping (mapping_id, category_id, department_id, priority) VALUES (13, 7, 14, 2) ON CONFLICT DO NOTHING;
INSERT INTO category_department_mapping (mapping_id, category_id, department_id, priority) VALUES (14, 7, 13, 1) ON CONFLICT DO NOTHING;
INSERT INTO category_department_mapping (mapping_id, category_id, department_id, priority) VALUES (15, 8, 17, 3) ON CONFLICT DO NOTHING;
INSERT INTO category_department_mapping (mapping_id, category_id, department_id, priority) VALUES (16, 8, 16, 2) ON CONFLICT DO NOTHING;
INSERT INTO category_department_mapping (mapping_id, category_id, department_id, priority) VALUES (17, 8, 15, 1) ON CONFLICT DO NOTHING;
INSERT INTO category_department_mapping (mapping_id, category_id, department_id, priority) VALUES (18, 9, 18, 1) ON CONFLICT DO NOTHING;
INSERT INTO category_department_mapping (mapping_id, category_id, department_id, priority) VALUES (19, 10, 19, 1) ON CONFLICT DO NOTHING;
INSERT INTO category_department_mapping (mapping_id, category_id, department_id, priority) VALUES (20, 10, 9, 2) ON CONFLICT DO NOTHING;
INSERT INTO category_department_mapping (mapping_id, category_id, department_id, priority) VALUES (21, 11, 20, 1) ON CONFLICT DO NOTHING;
INSERT INTO category_department_mapping (mapping_id, category_id, department_id, priority) VALUES (22, 11, 21, 2) ON CONFLICT DO NOTHING;
INSERT INTO category_department_mapping (mapping_id, category_id, department_id, priority) VALUES (23, 11, 22, 3) ON CONFLICT DO NOTHING;
INSERT INTO category_department_mapping (mapping_id, category_id, department_id, priority) VALUES (24, 11, 23, 4) ON CONFLICT DO NOTHING;
INSERT INTO category_department_mapping (mapping_id, category_id, department_id, priority) VALUES (25, 11, 24, 5) ON CONFLICT DO NOTHING;
INSERT INTO category_department_mapping (mapping_id, category_id, department_id, priority) VALUES (26, 6, 25, 3) ON CONFLICT DO NOTHING;
INSERT INTO category_department_mapping (mapping_id, category_id, department_id, priority) VALUES (27, 6, 26, 4) ON CONFLICT DO NOTHING;
INSERT INTO category_department_mapping (mapping_id, category_id, department_id, priority) VALUES (28, 6, 27, 5) ON CONFLICT DO NOTHING;
INSERT INTO category_department_mapping (mapping_id, category_id, department_id, priority) VALUES (29, 6, 28, 6) ON CONFLICT DO NOTHING;
INSERT INTO category_department_mapping (mapping_id, category_id, department_id, priority) VALUES (30, 6, 30, 7) ON CONFLICT DO NOTHING;
INSERT INTO category_department_mapping (mapping_id, category_id, department_id, priority) VALUES (31, 5, 29, 3) ON CONFLICT DO NOTHING;
INSERT INTO category_department_mapping (mapping_id, category_id, department_id, priority) VALUES (32, 4, 35, 3) ON CONFLICT DO NOTHING;

-- 29 긴급 키워드
INSERT INTO urgency_keywords (keyword_id, keyword, category_id, weight) VALUES (1, '화재', NULL, 0.95) ON CONFLICT DO NOTHING;
INSERT INTO urgency_keywords (keyword_id, keyword, category_id, weight) VALUES (2, '폭발음', NULL, 0.95) ON CONFLICT DO NOTHING;
INSERT INTO urgency_keywords (keyword_id, keyword, category_id, weight) VALUES (3, '감전', NULL, 0.95) ON CONFLICT DO NOTHING;
INSERT INTO urgency_keywords (keyword_id, keyword, category_id, weight) VALUES (4, '매몰', NULL, 0.95) ON CONFLICT DO NOTHING;
INSERT INTO urgency_keywords (keyword_id, keyword, category_id, weight) VALUES (5, '깔렸', NULL, 0.95) ON CONFLICT DO NOTHING;
INSERT INTO urgency_keywords (keyword_id, keyword, category_id, weight) VALUES (6, '추락', NULL, 0.95) ON CONFLICT DO NOTHING;
INSERT INTO urgency_keywords (keyword_id, keyword, category_id, weight) VALUES (7, '떨어졌', NULL, 0.95) ON CONFLICT DO NOTHING;
INSERT INTO urgency_keywords (keyword_id, keyword, category_id, weight) VALUES (8, '가스누출', NULL, 0.95) ON CONFLICT DO NOTHING;
INSERT INTO urgency_keywords (keyword_id, keyword, category_id, weight) VALUES (9, '가스 누설', NULL, 0.95) ON CONFLICT DO NOTHING;
INSERT INTO urgency_keywords (keyword_id, keyword, category_id, weight) VALUES (10, '산사태', NULL, 0.95) ON CONFLICT DO NOTHING;
INSERT INTO urgency_keywords (keyword_id, keyword, category_id, weight) VALUES (11, '지진', NULL, 0.95) ON CONFLICT DO NOTHING;
INSERT INTO urgency_keywords (keyword_id, keyword, category_id, weight) VALUES (12, '쓰나미', NULL, 0.95) ON CONFLICT DO NOTHING;
INSERT INTO urgency_keywords (keyword_id, keyword, category_id, weight) VALUES (13, '방사능', NULL, 0.95) ON CONFLICT DO NOTHING;
INSERT INTO urgency_keywords (keyword_id, keyword, category_id, weight) VALUES (14, '독극물', NULL, 0.95) ON CONFLICT DO NOTHING;
INSERT INTO urgency_keywords (keyword_id, keyword, category_id, weight) VALUES (15, '화학물질 누출', NULL, 0.95) ON CONFLICT DO NOTHING;
INSERT INTO urgency_keywords (keyword_id, keyword, category_id, weight) VALUES (16, '아동학대', NULL, 0.95) ON CONFLICT DO NOTHING;
INSERT INTO urgency_keywords (keyword_id, keyword, category_id, weight) VALUES (17, '가정폭력', NULL, 0.95) ON CONFLICT DO NOTHING;
INSERT INTO urgency_keywords (keyword_id, keyword, category_id, weight) VALUES (18, '노인학대', NULL, 0.95) ON CONFLICT DO NOTHING;
INSERT INTO urgency_keywords (keyword_id, keyword, category_id, weight) VALUES (19, '붕괴', NULL, 0.90) ON CONFLICT DO NOTHING;
INSERT INTO urgency_keywords (keyword_id, keyword, category_id, weight) VALUES (20, '무너지', NULL, 0.90) ON CONFLICT DO NOTHING;
INSERT INTO urgency_keywords (keyword_id, keyword, category_id, weight) VALUES (21, '무너졌', NULL, 0.90) ON CONFLICT DO NOTHING;
INSERT INTO urgency_keywords (keyword_id, keyword, category_id, weight) VALUES (22, '쓰러졌', NULL, 0.90) ON CONFLICT DO NOTHING;
INSERT INTO urgency_keywords (keyword_id, keyword, category_id, weight) VALUES (23, '쓰러진', NULL, 0.90) ON CONFLICT DO NOTHING;
INSERT INTO urgency_keywords (keyword_id, keyword, category_id, weight) VALUES (24, '전봇대 쓰러', NULL, 0.90) ON CONFLICT DO NOTHING;
INSERT INTO urgency_keywords (keyword_id, keyword, category_id, weight) VALUES (25, '토사 무너', NULL, 0.90) ON CONFLICT DO NOTHING;
INSERT INTO urgency_keywords (keyword_id, keyword, category_id, weight) VALUES (26, '독성', NULL, 0.90) ON CONFLICT DO NOTHING;
INSERT INTO urgency_keywords (keyword_id, keyword, category_id, weight) VALUES (27, '가스냄새', NULL, 0.85) ON CONFLICT DO NOTHING;
INSERT INTO urgency_keywords (keyword_id, keyword, category_id, weight) VALUES (28, '연기', NULL, 0.85) ON CONFLICT DO NOTHING;
INSERT INTO urgency_keywords (keyword_id, keyword, category_id, weight) VALUES (29, '전선 끊', NULL, 0.85) ON CONFLICT DO NOTHING;

-- 시퀀스 재설정
SELECT setval(pg_get_serial_sequence('categories', 'category_id'), (SELECT MAX(category_id) FROM categories));
SELECT setval(pg_get_serial_sequence('departments', 'department_id'), (SELECT MAX(department_id) FROM departments));
SELECT setval(pg_get_serial_sequence('category_department_mapping', 'mapping_id'), (SELECT MAX(mapping_id) FROM category_department_mapping));
SELECT setval(pg_get_serial_sequence('urgency_keywords', 'keyword_id'), (SELECT MAX(keyword_id) FROM urgency_keywords));
