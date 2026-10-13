/* ===== GAS 통신 ===== */
function checkConfig() {
  if (CONFIG.GAS_URL && /^https:\/\/script\.google\.com\/.+\/exec$/.test(CONFIG.GAS_URL)) return true;
  var w = $('configWarn');
  w.hidden = false;
  w.textContent = '⚠️ 아직 서버 주소가 설정되지 않았어요. js/config.js 의 GAS_URL 에 앱스크립트 배포 주소(…/exec)를 넣어주세요.';
  return false;
}

/* 페이지 열 때 서버 깨우기 (첫 응답 지연 줄이기) */
function warmup() {
  if (CONFIG.GAS_URL) fetch(CONFIG.GAS_URL, { method: 'GET' }).catch(function () {});
}

/* 자동 재시도 3회 */
async function gas(action, data, retries) {
  retries = retries || 3;
  var url = CONFIG.GAS_URL + '?action=' + encodeURIComponent(action);
  var body = JSON.stringify(Object.assign({}, data || {}, { action: action }));
  for (var i = 1; i <= retries; i++) {
    try {
      var res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: body });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return await res.json();
    } catch (e) {
      if (i === retries) throw e;
      await new Promise(function (r) { setTimeout(r, i * 1000); });
    }
  }
}
