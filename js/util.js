/* ===== 공통 도우미 ===== */
function $(id) { return document.getElementById(id); }

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* 공백(띄어쓰기·줄바꿈) 제외 글자수 */
function countChars(s) { return String(s || '').replace(/\s/g, '').length; }

function debounce(fn, ms) {
  var t;
  return function () { var a = arguments; clearTimeout(t); t = setTimeout(function () { fn.apply(null, a); }, ms); };
}

function toast(msg, type) {
  var el = $('toast');
  el.textContent = msg;
  el.className = 'show ' + (type || '');
  clearTimeout(toast._t);
  toast._t = setTimeout(function () { el.className = ''; }, 2600);
}

function setBusy(btn, on, label) {
  btn.disabled = on;
  btn.innerHTML = on ? '<span class="spinner"></span>' + esc(label) : esc(label);
}

/* 상태 → 배지 색 */
var STATUS_CLASS = { '작성중': 's-draft', '제출': 's-sub', '첨삭완료': 's-done', '수정중': 's-edit', '재제출': 's-resub' };
function badgeHTML(status) {
  return '<span class="badge ' + (STATUS_CLASS[status] || 's-draft') + '">' + esc(status || '작성중') + '</span>';
}

/* 'yyyy-MM-dd HH:mm:ss' → 'M/d HH:mm' */
function shortTime(t) {
  if (!t) return '';
  var m = String(t).match(/^\d{4}-(\d{2})-(\d{2}) (\d{2}):(\d{2})/);
  return m ? (+m[1]) + '/' + (+m[2]) + ' ' + m[3] + ':' + m[4] : t;
}

/* 제출 진행 바 */
function startProgress(anchor) {
  var wrap = document.createElement('div');
  wrap.className = 'prog-wrap';
  wrap.innerHTML = '<div class="prog-track"><div class="prog-fill"></div></div><div class="prog-label">연결하는 중...</div>';
  anchor.parentNode.insertBefore(wrap, anchor);
  var steps = [['30%', '연결하는 중'], ['65%', '저장하는 중'], ['85%', '거의 다 됐어요']], i = 0;
  var tick = setInterval(function () {
    if (i >= steps.length) { clearInterval(tick); return; }
    wrap.querySelector('.prog-fill').style.width = steps[i][0];
    wrap.querySelector('.prog-label').textContent = steps[i][1] + '...';
    i++;
  }, 700);
  return function stop() { clearInterval(tick); wrap.remove(); };
}
