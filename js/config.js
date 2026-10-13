/* ===== 설정 (선생님이 바꾸는 곳은 여기뿐) ===== */
var CONFIG = {
  // ① GAS 웹앱 배포 후 받은 주소를 따옴표 안에 붙여넣기 (…/exec 로 끝나는 주소)
  GAS_URL: 'https://script.google.com/macros/s/AKfycbytu0GrBjGQpZy9YOtKlcBlHYRYoV25pNWCsK81VSMI-slnCThdqaYMP76fltOSFW8j/exec',
  // ② 우리 학교 이름 (인쇄물 '출신중학교' 칸에 들어감) 예: '화천중학교'
  SCHOOL_NAME: '화천중학교',
  // ③ 3학년 반 수 (선생님 페이지 반 선택 목록)
  CLASS_COUNT: 4,
  // 서버 자동 저장 간격(분) — 고친 내용이 있을 때만 저장
  AUTO_SAVE_MIN: 3,
  TARGET_SCHOOL: '한국인공지능고등학교'
};

/* 원서 항목 — 글자수는 공백 제외 기준 */
var SECTIONS = [
  { key: 's1', title: '1. 지원 동기',            limit: 300 },
  { key: 's2', title: '2. 자신의 진로 분야',      limit: 300 },
  { key: 's3', title: '3. 고등학교 3년간의 계획',  limit: 500 },
  { key: 's4', title: '4. 자신의 포부',          limit: 300 }
];
