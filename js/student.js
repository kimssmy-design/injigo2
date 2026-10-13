/* ===== 학생 화면 로직 ===== */
(function () {
  var S = { me: null, pw: '', dirty: false, saving: false, ver: 0, tas: [] };
  var SESSION_KEY = 'cp_session', LAST_KEY = 'cp_last';
  function draftKey() { return 'cp_draft_' + S.me.id; }

  /* ---------- 시작 ---------- */
  function init() {
    checkConfig();
    warmup();
    buildSections();

    try {
      var last = JSON.parse(localStorage.getItem(LAST_KEY) || 'null');
      if (last) { $('inId').value = last.id || ''; $('inName').value = last.name || ''; }
    } catch (e) {}

    $('loginBtn').onclick = onLoginClick;
    $('inPw').addEventListener('keydown', function (e) { if (e.key === 'Enter') onLoginClick(); });
    $('inBirth').addEventListener('input', onAnyInput);
    $('saveBtn').onclick = function () { save(false, false); };
    $('submitBtn').onclick = onSubmit;
    $('printBtn').onclick = onPrint;
    $('logoutBtn').onclick = logout;
    $('refreshBtn').onclick = refresh;

    window.addEventListener('beforeunload', function (e) { if (S.dirty) { e.preventDefault(); e.returnValue = ''; } });
    setInterval(function () { if (S.me && S.dirty && !S.saving) save(false, true); }, CONFIG.AUTO_SAVE_MIN * 60000);

    try {
      var ss = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
      if (ss) doLogin(ss.id, ss.name, ss.pw, true);
    } catch (e) {}
  }

  /* ---------- 로그인 ---------- */
  function onLoginClick() {
    var id = $('inId').value.trim(), name = $('inName').value.replace(/\s/g, ''), pw = $('inPw').value.trim();
    var m = $('loginMsg');
    if (!/^3\d{3,4}$/.test(id)) { m.textContent = '학번을 확인해주세요. (예: 30105)'; return; }
    if (!name) { m.textContent = '이름을 입력해주세요.'; return; }
    if (pw.length < 4) { m.textContent = '비밀번호는 4자리 이상이에요.'; return; }
    doLogin(id, name, pw, false);
  }

  async function doLogin(id, name, pw, auto) {
    if (!checkConfig()) return;
    var btn = $('loginBtn'), m = $('loginMsg');
    m.textContent = '';
    setBusy(btn, true, auto ? '다시 연결 중...' : '확인 중...');
    try {
      var res = await gas('login', { id: id, name: name, pw: pw });
      if (!res.ok) { m.textContent = res.msg; sessionStorage.removeItem(SESSION_KEY); return; }
      S.me = res.student; S.pw = pw;
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ id: id, name: name, pw: pw }));
      localStorage.setItem(LAST_KEY, JSON.stringify({ id: id, name: name }));
      if (res.isNew) toast('등록 완료! 이제 써 볼까요? ✏️');
      else if (res.reset) toast('새 비밀번호로 설정됐어요.');
      openEditor();
    } catch (e) {
      m.textContent = '연결이 불안정해요. 잠시 후 다시 눌러주세요.';
    } finally {
      setBusy(btn, false, '시작하기 →');
    }
  }

  function logout() {
    if (S.dirty && !confirm('저장 안 된 내용이 있어요. (이 폰에는 임시 보관돼요)\n그래도 나갈까요?')) return;
    sessionStorage.removeItem(SESSION_KEY);
    S.dirty = false;
    location.reload();
  }

  /* ---------- 작성 화면 ---------- */
  function buildSections() {
    var box = $('sections');
    SECTIONS.forEach(function (s, i) {
      var ex = EXAMPLES[s.key];
      var card = document.createElement('article');
      card.className = 'card';
      card.innerHTML =
        '<div class="sec-head"><h2>' + esc(s.title) + '</h2><span class="count"><b>0</b> / ' + s.limit + '자</span></div>' +
        '<div class="comment" hidden><div class="ct">💬 선생님 첨삭<time></time></div><p></p></div>' +
        '<textarea class="answer" placeholder="여기에 작성하세요"></textarea>' +
        '<div class="count-bar"><i></i></div><p class="over-msg" hidden></p>' +
        '<button type="button" class="more-btn">📖 작성 팁 · 예시 더보기 ▾</button>' +
        '<div class="more" hidden>' +
          '<ul class="tips">' + ex.tips.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>' +
          '<p class="ex-warn">⚠️ 예시는 참고만! 그대로 베끼면 안 되고, 나의 경험으로 바꿔 써야 해요.</p>' +
          ex.items.map(function (it) {
            return '<div class="ex"><div class="ex-label">' + esc(it.label) + '<span>' + countChars(it.text) + '자</span></div><p>' + esc(it.text) + '</p></div>';
          }).join('') +
        '</div>';
      box.appendChild(card);

      var ta = card.querySelector('textarea');
      S.tas.push(ta);
      ta.addEventListener('input', function () { updateCount(i); autosize(ta); onAnyInput(); });
      var more = card.querySelector('.more'), mb = card.querySelector('.more-btn');
      mb.onclick = function () {
        more.hidden = !more.hidden;
        mb.textContent = more.hidden ? '📖 작성 팁 · 예시 더보기 ▾' : '📖 접기 ▴';
      };
    });
  }

  function autosize(ta) { ta.style.height = 'auto'; ta.style.height = Math.max(ta.scrollHeight + 2, 150) + 'px'; }

  function updateCount(i) {
    var lim = SECTIONS[i].limit, n = countChars(S.tas[i].value);
    var card = S.tas[i].closest('.card');
    var c = card.querySelector('.count'), bar = card.querySelector('.count-bar i'), om = card.querySelector('.over-msg');
    var over = n > lim, warn = !over && n >= lim * 0.9;
    c.innerHTML = '<b>' + n + '</b> / ' + lim + '자';
    c.className = 'count' + (over ? ' over' : warn ? ' warn' : '');
    bar.style.width = Math.min(100, n / lim * 100) + '%';
    bar.className = over ? 'over' : warn ? 'warn' : '';
    S.tas[i].classList.toggle('over', over);
    om.hidden = !over;
    om.textContent = over ? (n - lim) + '자를 줄여야 제출할 수 있어요.' : '';
  }

  function openEditor() {
    var me = S.me;
    $('whoName').textContent = me.name;
    $('whoId').textContent = me.id + ' · 3학년 ' + me.cls + '반';
    $('fixedInfo').textContent = '출신중학교 ' + (CONFIG.SCHOOL_NAME || '(설정 전)') + ' · 3학년 ' + me.cls + '반 — 자동 입력돼요.';
    fillFields(me.birth, me.answers);
    renderStatus();
    setSaveState(me.submitted ? 'ok' : 'idle');
    renderComments();
    checkDraft();
    $('loginView').hidden = true;
    $('editView').hidden = false;
    window.scrollTo(0, 0);
  }

  function fillFields(birth, answers) {
    $('inBirth').value = birth || '';
    S.tas.forEach(function (ta, i) { ta.value = (answers && answers[i]) || ''; updateCount(i); });
    requestAnimationFrame(function () { S.tas.forEach(autosize); });
  }

  function renderStatus() {
    $('statusBadge').innerHTML = badgeHTML(S.me.status);
    $('submitBtn').textContent = S.me.submitted ? '📤 다시 제출' : '📤 제출';
  }

  function renderComments() {
    S.tas.forEach(function (ta, i) {
      var box = ta.closest('.card').querySelector('.comment');
      var c = (S.me.comments && S.me.comments[i]) || '';
      box.hidden = !c.trim();
      box.querySelector('p').textContent = c;
      box.querySelector('time').textContent = S.me.cAt ? shortTime(S.me.cAt) : '';
    });
  }

  /* ---------- 저장 상태 표시 ---------- */
  function setSaveState(kind, text) {
    var el = $('saveState');
    el.className = 'savebar' + (kind === 'dirty' ? ' dirty' : kind === 'ok' || kind === 'saved' ? ' ok' : kind === 'err' ? ' err' : '');
    if (kind === 'dirty') el.textContent = '✏️ 저장 안 된 내용 있음 · 이 폰에는 임시 보관 중';
    else if (kind === 'saving') el.textContent = '⏳ 서버에 저장하는 중...';
    else if (kind === 'saved') el.textContent = '✅ 서버에 저장됨 · ' + shortTime(S.me.saved);
    else if (kind === 'ok') el.textContent = '✅ 제출함 · ' + shortTime(S.me.submitted) + (S.me.saved !== S.me.submitted ? ' (마지막 저장 ' + shortTime(S.me.saved) + ')' : '');
    else if (kind === 'err') el.textContent = '⚠️ ' + (text || '저장 실패') ;
    else el.textContent = S.me && S.me.saved ? '💾 마지막 저장 ' + shortTime(S.me.saved) : '';
  }

  /* ---------- 폰 임시 보관 ---------- */
  function collect() {
    return { birth: $('inBirth').value.trim(), answers: S.tas.map(function (t) { return t.value; }) };
  }

  var saveLocal = debounce(function () {
    if (!S.me) return;
    var d = collect(); d.t = Date.now();
    try { localStorage.setItem(draftKey(), JSON.stringify(d)); } catch (e) {}
  }, 600);

  function onAnyInput() {
    S.ver++;
    S.dirty = true;
    setSaveState('dirty');
    saveLocal();
  }

  function sameAsServer(d) {
    if ((d.birth || '') !== (S.me.birth || '')) return false;
    for (var i = 0; i < 4; i++) if ((d.answers[i] || '') !== (S.me.answers[i] || '')) return false;
    return true;
  }

  function checkDraft() {
    var b = $('restoreBanner');
    b.hidden = true;
    var d;
    try { d = JSON.parse(localStorage.getItem(draftKey()) || 'null'); } catch (e) { d = null; }
    if (!d || !d.answers) return;
    if (sameAsServer(d)) { localStorage.removeItem(draftKey()); return; }
    var dt = new Date(d.t);
    var t = (dt.getMonth() + 1) + '/' + dt.getDate() + ' ' + String(dt.getHours()).padStart(2, '0') + ':' + String(dt.getMinutes()).padStart(2, '0');
    b.innerHTML = '📱 <b>이 폰에 서버에 저장 안 된 내용</b>이 있어요.<br>' +
      '<small>폰 임시본: ' + t + ' · 서버 저장: ' + (shortTime(S.me.saved) || '없음') + '</small>' +
      '<div class="row"><button class="btn primary" id="rsYes">폰 임시본 불러오기</button><button class="btn" id="rsNo">버리기</button></div>';
    b.hidden = false;
    $('rsYes').onclick = function () {
      fillFields(d.birth, d.answers);
      S.ver++; S.dirty = true; setSaveState('dirty');
      b.hidden = true;
      toast('불러왔어요. 💾 중간저장을 눌러 서버에도 저장하세요.');
    };
    $('rsNo').onclick = function () {
      if (!confirm('폰 임시본을 지울까요?')) return;
      localStorage.removeItem(draftKey());
      b.hidden = true;
    };
  }

  /* ---------- 서버 저장·제출 ---------- */
  async function save(submit, quiet) {
    if (S.saving) { if (!quiet) toast('저장 중이에요. 잠시만요!'); return false; }
    S.saving = true;
    var ver = S.ver, d = collect(), stopProg = null;
    var btn = submit ? $('submitBtn') : $('saveBtn'), label = btn.textContent;
    setSaveState('saving');
    if (!quiet) {
      setBusy(btn, true, submit ? '제출 중...' : '저장 중...');
      if (submit) stopProg = startProgress($('saveBtn'));
    }
    try {
      var res = await gas('save', { id: S.me.id, name: S.me.name, pw: S.pw, birth: d.birth, answers: d.answers, submit: !!submit });
      if (!res.ok) {
        setSaveState('err', res.msg);
        if (!quiet) toast(res.msg, 'err');
        if (res.relogin) { sessionStorage.removeItem(SESSION_KEY); setTimeout(function () { location.reload(); }, 1800); }
        return false;
      }
      S.me.status = res.status; S.me.saved = res.saved; S.me.submitted = res.submitted;
      S.me.birth = d.birth; S.me.answers = d.answers;
      if (S.ver === ver) { S.dirty = false; localStorage.removeItem(draftKey()); }
      renderStatus();
      setSaveState(S.dirty ? 'dirty' : submit ? 'ok' : 'saved');
      if (!quiet) toast(submit ? '제출 완료! 🎉 선생님 첨삭을 기다려요.' : '저장했어요 💾');
      return true;
    } catch (e) {
      setSaveState('err', '연결 실패 — 폰에는 임시 보관돼 있어요. 다시 저장해주세요.');
      if (!quiet) toast('연결이 불안정해요. 다시 눌러주세요.', 'err');
      return false;
    } finally {
      if (stopProg) stopProg();
      if (!quiet) { btn.disabled = false; btn.textContent = label; renderStatus(); }
      S.saving = false;
    }
  }

  function onSubmit() {
    var d = collect(), probs = [];
    SECTIONS.forEach(function (s, i) {
      var n = countChars(d.answers[i]);
      if (!n) probs.push(s.title + ' — 비어 있어요');
      else if (n > s.limit) probs.push(s.title + ' — ' + (n - s.limit) + '자 초과');
    });
    if (probs.length) { alert('제출 전에 확인해주세요!\n\n' + probs.join('\n')); return; }
    if (!d.birth && !confirm('생년월일이 비어 있어요. 그래도 제출할까요?')) return;
    var again = !!S.me.submitted;
    if (!confirm(again ? '고친 내용으로 다시 제출할까요?' : '제출할까요?\n제출한 뒤에도 고치고 다시 제출할 수 있어요.')) return;
    save(true, false);
  }

  /* 첨삭 확인 (서버에서 최신 상태 다시 받기) */
  async function refresh() {
    var b = $('refreshBtn');
    b.disabled = true; b.textContent = '⏳';
    try {
      var res = await gas('login', { id: S.me.id, name: S.me.name, pw: S.pw });
      if (!res.ok) { toast(res.msg, 'err'); return; }
      var st = res.student, hadComment = S.me.cAt;
      S.me.status = st.status; S.me.comments = st.comments; S.me.cAt = st.cAt;
      S.me.saved = st.saved; S.me.submitted = st.submitted;
      if (!S.dirty) { S.me.birth = st.birth; S.me.answers = st.answers; fillFields(st.birth, st.answers); }
      renderStatus(); renderComments();
      if (!S.dirty) setSaveState(st.submitted ? 'ok' : 'idle');
      toast(st.cAt && st.cAt !== hadComment ? '새 첨삭이 도착했어요! 💬' : st.cAt ? '첨삭을 확인하세요 💬' : '아직 첨삭이 없어요.');
    } catch (e) {
      toast('연결이 불안정해요.', 'err');
    } finally {
      b.disabled = false; b.textContent = '🔄';
    }
  }

  function onPrint() {
    var d = collect();
    printSheets([{ name: S.me.name, cls: S.me.cls, birth: d.birth, answers: d.answers }]);
  }

  init();
})();
