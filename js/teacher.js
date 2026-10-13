/* ===== 담임 첨삭 화면 로직 ===== */
(function () {
  var T = { cls: '', pw: '', list: [], filter: '전체', clsFilter: 'all', curId: null, cmtDirty: false };
  var SESSION_KEY = 'cp_tsession';
  var STATUSES = ['작성중', '제출', '첨삭완료', '수정중', '재제출'];

  function init() {
    checkConfig();
    warmup();
    var sel = $('tCls');
    for (var i = 1; i <= CONFIG.CLASS_COUNT; i++) sel.insertAdjacentHTML('beforeend', '<option value="' + i + '">3학년 ' + i + '반</option>');
    sel.insertAdjacentHTML('beforeend', '<option value="전체">전체 (진로부 등)</option>');

    $('tLoginBtn').onclick = function () { login($('tCls').value, $('tPw').value.trim()); };
    $('tPw').addEventListener('keydown', function (e) { if (e.key === 'Enter') $('tLoginBtn').click(); });
    $('reloadBtn').onclick = function () { load(true); };
    $('tLogoutBtn').onclick = function () { sessionStorage.removeItem(SESSION_KEY); location.reload(); };
    $('batchPrintBtn').onclick = batchPrint;
    $('clsFilter').onchange = function () { T.clsFilter = this.value; renderList(); };
    $('backBtn').onclick = function () { if (leaveOk()) showList(); };
    $('prevBtn').onclick = function () { move(-1); };
    $('nextBtn').onclick = function () { move(1); };
    $('dSaveBtn').onclick = saveComment;
    $('dPrintBtn').onclick = function () { var s = cur(); if (s) printSheets([s]); };
    $('dResetBtn').onclick = resetPw;
    window.addEventListener('beforeunload', function (e) { if (T.cmtDirty) { e.preventDefault(); e.returnValue = ''; } });

    try {
      var ss = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
      if (ss) { $('tCls').value = ss.cls; login(ss.cls, ss.pw); }
    } catch (e) {}
  }

  /* ---------- 로그인·불러오기 ---------- */
  async function login(cls, pw) {
    if (!checkConfig()) return;
    if (!pw) { $('tMsg').textContent = '비밀번호를 입력해주세요.'; return; }
    T.cls = cls; T.pw = pw;
    var btn = $('tLoginBtn');
    setBusy(btn, true, '확인 중...');
    $('tMsg').textContent = '';
    var ok = await load(false);
    setBusy(btn, false, '들어가기');
    if (!ok) return;
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ cls: cls, pw: pw }));
    $('tTitle').textContent = cls === '전체' ? '진로계획서 · 전체 반' : '진로계획서 · 3학년 ' + cls + '반';
    if (cls === '전체') {
      var f = $('clsFilter');
      f.hidden = false;
      f.innerHTML = '<option value="all">모든 반</option>';
      for (var i = 1; i <= CONFIG.CLASS_COUNT; i++) f.insertAdjacentHTML('beforeend', '<option value="' + i + '">' + i + '반</option>');
    }
    showList();
  }

  async function load(manual) {
    var rb = $('reloadBtn');
    if (manual) setBusy(rb, true, '불러오는 중');
    try {
      var res = await gas('tList', { cls: T.cls, tpw: T.pw });
      if (!res.ok) {
        $('tMsg').textContent = res.msg;
        if (manual) toast(res.msg, 'err');
        sessionStorage.removeItem(SESSION_KEY);
        return false;
      }
      T.list = res.list;
      if (manual) { renderList(); toast('최신 내용으로 불러왔어요.'); }
      return true;
    } catch (e) {
      $('tMsg').textContent = '연결이 불안정해요. 다시 시도해주세요.';
      if (manual) toast('연결이 불안정해요.', 'err');
      return false;
    } finally {
      if (manual) setBusy(rb, false, '🔄 새로고침');
    }
  }

  /* ---------- 목록 ---------- */
  function visible() {
    return T.list.filter(function (s) {
      if (T.clsFilter !== 'all' && String(s.cls) !== T.clsFilter) return false;
      return T.filter === '전체' || s.status === T.filter;
    });
  }

  function showList() {
    T.curId = null; T.cmtDirty = false;
    $('loginView').hidden = true; $('detailView').hidden = true; $('listView').hidden = false;
    renderList();
    window.scrollTo(0, 0);
  }

  function renderList() {
    var base = T.list.filter(function (s) { return T.clsFilter === 'all' || String(s.cls) === T.clsFilter; });
    var counts = { '전체': base.length };
    STATUSES.forEach(function (st) { counts[st] = base.filter(function (s) { return s.status === st; }).length; });
    $('chips').innerHTML = ['전체'].concat(STATUSES).map(function (st) {
      return '<button class="chip' + (T.filter === st ? ' on' : '') + '" data-st="' + st + '">' + st + '<b>' + counts[st] + '</b></button>';
    }).join('');
    $('chips').querySelectorAll('.chip').forEach(function (c) { c.onclick = function () { T.filter = c.dataset.st; renderList(); }; });

    var v = visible();
    if (!v.length) { $('list').innerHTML = '<div class="empty-list">해당하는 학생이 없어요.</div>'; return; }
    $('list').innerHTML = v.map(function (s) {
      var cnts = SECTIONS.map(function (sec, i) {
        var n = countChars(s.answers[i]);
        return '<span class="' + (n > sec.limit ? 'over' : !n ? 'empty' : '') + '">' + (i + 1) + '번 ' + n + '/' + sec.limit + '</span>';
      }).join('');
      var time = s.submitted ? '제출 ' + shortTime(s.submitted) : '';
      if (s.saved && s.saved !== s.submitted) time += (time ? ' · ' : '') + '저장 ' + shortTime(s.saved);
      if (s.cAt) time += ' · 첨삭 ' + shortTime(s.cAt);
      return '<div class="item" data-id="' + esc(s.id) + '">' +
        '<div class="item-top"><span class="nm">' + esc(s.name) + '</span><span class="id">' + esc(s.id) + (T.cls === '전체' ? ' · ' + esc(s.cls) + '반' : '') + '</span>' + badgeHTML(s.status) + '</div>' +
        '<div class="item-counts">' + cnts + '</div>' +
        '<div class="item-time">' + esc(time || '아직 작성 전') + '</div></div>';
    }).join('');
    $('list').querySelectorAll('.item').forEach(function (el) { el.onclick = function () { openDetail(el.dataset.id); }; });
  }

  /* ---------- 상세·첨삭 ---------- */
  function cur() { return T.list.filter(function (s) { return s.id === T.curId; })[0]; }

  function leaveOk() { return !T.cmtDirty || confirm('저장 안 한 첨삭이 있어요. 그래도 나갈까요?'); }

  function move(dir) {
    var v = visible(), idx = v.findIndex(function (s) { return s.id === T.curId; });
    var next = v[idx + dir];
    if (!next) { toast(dir < 0 ? '첫 번째 학생이에요.' : '마지막 학생이에요.'); return; }
    if (leaveOk()) openDetail(next.id);
  }

  function openDetail(id) {
    T.curId = id; T.cmtDirty = false;
    var s = cur();
    $('dName').textContent = s.name;
    $('dMeta').textContent = s.id + ' · ' + s.cls + '반 · 생년월일 ' + (s.birth || '미입력');
    var t = [badgeHTML(s.status)];
    if (s.submitted) t.push('제출 ' + shortTime(s.submitted));
    if (s.saved) t.push('마지막 저장 ' + shortTime(s.saved));
    if (s.cAt) t.push('마지막 첨삭 ' + shortTime(s.cAt));
    $('dStatus').innerHTML = t.join(' · ');

    $('dSections').innerHTML = SECTIONS.map(function (sec, i) {
      var txt = s.answers[i] || '', n = countChars(txt);
      return '<div class="card d-sec">' +
        '<h2>' + esc(sec.title) + '<span class="count' + (n > sec.limit ? ' over' : '') + '">' + n + ' / ' + sec.limit + '자</span></h2>' +
        '<div class="d-text' + (txt.trim() ? '' : ' none') + '">' + (txt.trim() ? esc(txt) : '(아직 작성하지 않음)') + '</div>' +
        '<textarea class="d-cmt" data-i="' + i + '" placeholder="이 항목 첨삭 코멘트 (비워 두면 학생 화면에 안 보여요)">' + esc((s.comments && s.comments[i]) || '') + '</textarea>' +
        '</div>';
    }).join('');
    $('dSections').querySelectorAll('.d-cmt').forEach(function (ta) { ta.oninput = function () { T.cmtDirty = true; }; });

    $('listView').hidden = true; $('detailView').hidden = false;
    window.scrollTo(0, 0);
  }

  async function saveComment() {
    var s = cur(), btn = $('dSaveBtn');
    var comments = Array.prototype.map.call($('dSections').querySelectorAll('.d-cmt'), function (ta) { return ta.value; });
    setBusy(btn, true, '저장 중...');
    try {
      var res = await gas('tComment', { cls: T.cls, tpw: T.pw, id: s.id, comments: comments });
      if (!res.ok) { toast(res.msg, 'err'); return; }
      s.comments = comments; s.cAt = res.cAt; s.status = res.status;
      T.cmtDirty = false;
      openDetail(s.id);
      toast('첨삭을 저장했어요. 학생이 🔄을 누르면 보여요.');
    } catch (e) {
      toast('연결이 불안정해요. 다시 눌러주세요.', 'err');
    } finally {
      setBusy(btn, false, '💬 첨삭 저장 (학생에게 표시)');
    }
  }

  async function resetPw() {
    var s = cur();
    if (!confirm(s.name + ' 학생의 비밀번호를 초기화할까요?\n학생이 다음에 로그인할 때 입력한 비밀번호가 새 비밀번호가 돼요.')) return;
    var btn = $('dResetBtn');
    setBusy(btn, true, '초기화 중...');
    try {
      var res = await gas('tResetPw', { cls: T.cls, tpw: T.pw, id: s.id });
      toast(res.ok ? '초기화했어요. 학생에게 새 비밀번호로 로그인하라고 알려주세요.' : res.msg, res.ok ? '' : 'err');
    } catch (e) {
      toast('연결이 불안정해요.', 'err');
    } finally {
      setBusy(btn, false, '🔑 비밀번호 초기화');
    }
  }

  function batchPrint() {
    var v = visible().filter(function (s) { return s.answers.some(function (a) { return a && a.trim(); }); });
    if (!v.length) { toast('인쇄할 학생이 없어요.', 'err'); return; }
    if (!confirm(v.length + '명의 진로계획서를 인쇄할까요? (1명당 A4 1장)')) return;
    printSheets(v);
  }

  init();
})();
