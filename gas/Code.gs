/**
 * 진로계획서 작성·첨삭 — GAS 백엔드
 * 시트: '진로계획서'(학생 데이터, 자동 생성) / '담임'(반·비밀번호, 자동 생성 후 선생님이 입력)
 * 규칙: var 사용, 구조분해 금지, LockService.getScriptLock(), 텍스트는 setNumberFormat('@')
 */
var SHEET_MAIN = '진로계획서';
var SHEET_TEACHER = '담임';
var HEADERS = ['학번', '이름', '비번', '반', '생년월일',
  '지원동기', '진로분야', '3년계획', '포부',
  '상태', '최종저장', '제출일시',
  '첨삭_지원동기', '첨삭_진로분야', '첨삭_3년계획', '첨삭_포부', '첨삭일시'];
var LIMITS = [300, 300, 500, 300];   // 공백 포함 글자수
var MAX_RAW = 3000;                  // 항목당 최대 원문 길이(악용 방지)

/* ---------- 라우터 ---------- */
function doGet(e) {
  return out({ ok: true, msg: 'running' });
}

function doPost(e) {
  var params = {};
  try { params = JSON.parse(e.postData.contents); } catch (err) {}
  var action = (e.parameter && e.parameter.action) || params.action;
  var result;
  try {
    if (action === 'login') result = handleLogin(params);
    else if (action === 'save') result = handleSave(params);
    else if (action === 'tList') result = handleTList(params);
    else if (action === 'tComment') result = handleTComment(params);
    else if (action === 'tResetPw') result = handleTResetPw(params);
    else result = { ok: false, msg: '알 수 없는 요청' };
  } catch (err) {
    result = { ok: false, msg: '서버 오류: ' + err.message };
  }
  return out(result);
}

/* ---------- 도우미 ---------- */
function out(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
function now() { return Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss'); }
function str(v) { return (v === null || v === undefined) ? '' : String(v).trim(); }
function raw(v) { return (v === null || v === undefined) ? '' : String(v); }
function countChars(s) { return String(s || '').replace(/\r\n/g, '\n').length; }
/* =,+,-,@ 로 시작하면 수식으로 인식되지 않도록 ' 붙이기 (시트에선 안 보임) */
function safe(s) { s = raw(s); return /^[=+\-@]/.test(s) ? "'" + s : s; }
/* 읽을 때 위에서 붙인 ' 제거 */
function txt(v) { return raw(v).replace(/^'(?=[=+\-@])/, ''); }

function classOf(id) {
  return id.length === 5 ? String(parseInt(id.substr(1, 2), 10)) : String(parseInt(id.substr(1, 1), 10));
}

function getMain() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_MAIN);
  if (!sh) sh = ss.insertSheet(SHEET_MAIN);
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, sh.getMaxRows(), HEADERS.length).setNumberFormat('@');
    sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight('bold').setBackground('#e8ecf6');
    sh.setFrozenRows(1);
  }
  return sh;
}

function getTeacher() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_TEACHER);
  if (!sh) sh = ss.insertSheet(SHEET_TEACHER);
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, sh.getMaxRows(), 2).setNumberFormat('@');
    sh.getRange(1, 1, 1, 2).setValues([['반', '비밀번호']]).setFontWeight('bold').setBackground('#fbf3dc');
    sh.setFrozenRows(1);
  }
  return sh;
}

function findStudent(sh, id) {
  var data = sh.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (str(data[i][0]) === id) return { row: i + 1, v: data[i] };
  }
  return null;
}

function rowToStudent(v) {
  return {
    id: str(v[0]), name: str(v[1]), cls: str(v[3]), birth: txt(v[4]).trim(),
    answers: [txt(v[5]), txt(v[6]), txt(v[7]), txt(v[8])],
    status: str(v[9]) || '작성중', saved: str(v[10]), submitted: str(v[11]),
    comments: [txt(v[12]), txt(v[13]), txt(v[14]), txt(v[15])], cAt: str(v[16])
  };
}

function lockOrNull() {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(15000); } catch (e) { return null; }
  return lock;
}
var BUSY = { ok: false, msg: '지금 접속한 친구가 많아요. 잠시 후 다시 눌러주세요! 🙏' };

/* ---------- 학생: 로그인(첫 접속이면 자동 등록) ---------- */
function handleLogin(params) {
  var id = str(params.id);
  var name = str(params.name).replace(/\s/g, '');
  var pw = str(params.pw);
  if (!/^3\d{3,4}$/.test(id)) return { ok: false, msg: '학번을 확인해주세요. (예: 3105)' };
  if (!name) return { ok: false, msg: '이름을 입력해주세요.' };
  if (pw.length < 4) return { ok: false, msg: '비밀번호는 4자리 이상이에요.' };

  var lock = lockOrNull();
  if (!lock) return BUSY;
  try {
    var sh = getMain();
    var f = findStudent(sh, id);
    if (!f) {
      var row = [id, name, pw, classOf(id), '', '', '', '', '', '작성중', now(), '', '', '', '', '', ''];
      var r = sh.getLastRow() + 1;
      sh.getRange(r, 1, 1, HEADERS.length).setNumberFormat('@').setValues([row]);
      SpreadsheetApp.flush();
      return { ok: true, isNew: true, student: rowToStudent(row) };
    }
    if (str(f.v[1]) !== name) {
      return { ok: false, msg: '이 학번은 다른 이름으로 등록되어 있어요. 학번·이름을 확인하거나 선생님께 말씀해주세요.' };
    }
    var stored = str(f.v[2]);
    if (!stored) {
      sh.getRange(f.row, 3).setNumberFormat('@').setValue(String(pw));
      SpreadsheetApp.flush();
      return { ok: true, reset: true, student: rowToStudent(f.v) };
    }
    if (stored !== pw) return { ok: false, msg: '비밀번호가 틀렸어요. 잊었다면 담임 선생님께 초기화를 부탁하세요.' };
    return { ok: true, student: rowToStudent(f.v) };
  } finally {
    lock.releaseLock();
  }
}

/* ---------- 학생: 중간저장 / 제출 ---------- */
function handleSave(params) {
  var id = str(params.id);
  var name = str(params.name);
  var pw = str(params.pw);
  var answers = params.answers;
  var submit = params.submit === true;
  if (!answers || answers.length !== 4) return { ok: false, msg: '잘못된 요청이에요.' };

  var birth = str(params.birth).substr(0, 20);
  var clean = [];
  for (var i = 0; i < 4; i++) {
    var a = raw(answers[i]);
    if (a.length > MAX_RAW) return { ok: false, msg: (i + 1) + '번 항목이 너무 길어요.' };
    if (submit) {
      if (!a.trim()) return { ok: false, msg: (i + 1) + '번 항목이 비어 있어요.' };
      if (countChars(a) > LIMITS[i]) return { ok: false, msg: (i + 1) + '번 항목이 ' + LIMITS[i] + '자를 넘었어요.' };
    }
    clean.push(safe(a));
  }

  var lock = lockOrNull();
  if (!lock) return BUSY;
  try {
    var sh = getMain();
    var f = findStudent(sh, id);
    if (!f) return { ok: false, msg: '등록 정보를 찾을 수 없어요. 다시 로그인해주세요.', relogin: true };
    if (!pw || str(f.v[1]) !== name || str(f.v[2]) !== pw) {
      return { ok: false, msg: '로그인 정보가 바뀌었어요. 다시 로그인해주세요.', relogin: true };
    }
    var prevSubmitted = str(f.v[11]);
    var t = now();
    var status, submitted = prevSubmitted;
    if (submit) { status = prevSubmitted ? '재제출' : '제출'; submitted = t; }
    else { status = prevSubmitted ? '수정중' : '작성중'; }

    sh.getRange(f.row, 5, 1, 8).setNumberFormat('@')
      .setValues([[safe(birth), clean[0], clean[1], clean[2], clean[3], status, t, submitted]]);
    SpreadsheetApp.flush();
    return { ok: true, status: status, saved: t, submitted: submitted };
  } finally {
    lock.releaseLock();
  }
}

/* ---------- 담임: 인증 ---------- */
function authTeacher(params) {
  var cls = str(params.cls);
  var pw = str(params.tpw);
  if (!cls || !pw) return null;
  var data = getTeacher().getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (str(data[i][0]) === cls && str(data[i][1]) === pw) return cls;
  }
  return null;
}
var T_FAIL = { ok: false, msg: '반 또는 비밀번호가 틀렸어요. (구글시트 담임 탭 확인)' };

function canSee(cls, row) { return cls === '전체' || str(row[3]) === cls; }

/* ---------- 담임: 목록 ---------- */
function handleTList(params) {
  var cls = authTeacher(params);
  if (!cls) return T_FAIL;
  var data = getMain().getDataRange().getValues();
  var list = [];
  for (var i = 1; i < data.length; i++) {
    if (!str(data[i][0])) continue;
    if (canSee(cls, data[i])) list.push(rowToStudent(data[i]));
  }
  list.sort(function (a, b) { return a.id < b.id ? -1 : a.id > b.id ? 1 : 0; });
  return { ok: true, list: list };
}

/* ---------- 담임: 첨삭 저장 ---------- */
function handleTComment(params) {
  var cls = authTeacher(params);
  if (!cls) return T_FAIL;
  var id = str(params.id);
  var comments = params.comments;
  if (!comments || comments.length !== 4) return { ok: false, msg: '잘못된 요청이에요.' };

  var lock = lockOrNull();
  if (!lock) return { ok: false, msg: '잠시 후 다시 시도해주세요. (서버 혼잡)' };
  try {
    var sh = getMain();
    var f = findStudent(sh, id);
    if (!f || !canSee(cls, f.v)) return { ok: false, msg: '학생을 찾을 수 없어요.' };
    var t = now();
    sh.getRange(f.row, 13, 1, 5).setNumberFormat('@')
      .setValues([[safe(raw(comments[0]).substr(0, MAX_RAW)), safe(raw(comments[1]).substr(0, MAX_RAW)),
                   safe(raw(comments[2]).substr(0, MAX_RAW)), safe(raw(comments[3]).substr(0, MAX_RAW)), t]]);
    sh.getRange(f.row, 10).setNumberFormat('@').setValue('첨삭완료');
    SpreadsheetApp.flush();
    return { ok: true, cAt: t, status: '첨삭완료' };
  } finally {
    lock.releaseLock();
  }
}

/* ---------- 담임: 비밀번호 초기화 ---------- */
function handleTResetPw(params) {
  var cls = authTeacher(params);
  if (!cls) return T_FAIL;
  var id = str(params.id);
  var lock = lockOrNull();
  if (!lock) return { ok: false, msg: '잠시 후 다시 시도해주세요. (서버 혼잡)' };
  try {
    var sh = getMain();
    var f = findStudent(sh, id);
    if (!f || !canSee(cls, f.v)) return { ok: false, msg: '학생을 찾을 수 없어요.' };
    sh.getRange(f.row, 3).setNumberFormat('@').setValue('');
    SpreadsheetApp.flush();
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}

/* ---------- 최초 1회 실행: 시트 두 개 만들기 ---------- */
function setup() {
  getMain();
  getTeacher();
  Logger.log('시트 준비 완료. 담임 탭에 반(숫자 또는 전체)과 비밀번호를 입력하세요.');
}

/* ---------- 편집기에서 테스트용 ---------- */
function testLogin() {
  Logger.log(JSON.stringify(handleLogin({ id: '39999', name: '테스트', pw: '0123' })));
}
function testSave() {
  Logger.log(JSON.stringify(handleSave({ id: '39999', name: '테스트', pw: '0123', birth: '2011. 3. 5.', answers: ['가', '나', '다', '라'], submit: true })));
}
