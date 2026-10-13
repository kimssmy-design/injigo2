/* ===== 원서양식(A4 세로) 인쇄 ===== */
/* d = { name, cls, birth, answers:[4] } */
function buildSheetHTML(d) {
  var school = CONFIG.SCHOOL_NAME || '\u3000\u3000\u3000\u3000중학교';
  var flex = [3, 3, 5, 3];
  var secs = SECTIONS.map(function (s, i) {
    return '<div class="sh-sec" style="flex-grow:' + flex[i] + '">' +
      '<div class="sh-h">' + esc(s.title) + '(' + s.limit + '자 이내)</div>' +
      '<div class="sh-body">' + esc((d.answers && d.answers[i]) || '') + '</div></div>';
  }).join('');
  return '' +
    '<div class="sheet">' +
      '<div class="sh-top">' +
        '<div class="sh-title">진로계획서</div>' +
        '<table class="sh-no"><tr><th>*수험번호</th><td class="gray"></td></tr><tr><th>*접수번호</th><td></td></tr></table>' +
      '</div>' +
      '<p class="sh-note">* 표시란은 기재하지 마시오.</p>' +
      '<table class="sh-info">' +
        '<colgroup><col style="width:16%"><col style="width:24%"><col style="width:34%"><col style="width:26%"></colgroup>' +
        '<tr><th class="g">성\u3000\u3000명</th><td>' + esc(d.name) + '</td><th>생년월일</th><td>' + esc(d.birth) + '</td></tr>' +
        '<tr><th class="g">출신중학교</th><td>' + esc(school) + '</td>' +
          '<th>학년, 반<br><small>(졸업자, 검정고시 합격자 미표기)</small></th>' +
          '<td>3학년 ' + esc(d.cls || '') + '반</td></tr>' +
      '</table>' +
      '<p class="sh-self">※ 자필 작성</p>' +
      '<div class="sh-secs">' + secs + '</div>' +
      '<p class="sh-foot">웹 작성 참고본 — 원서에는 반드시 자필로 옮겨 쓰세요.</p>' +
    '</div>';
}

/* 내용이 많으면 글씨를 한 단계씩 줄여 A4 한 장에 맞춤 */
function fitSheets(area) {
  var sizes = [10.5, 10, 9.5, 9, 8.5, 8];
  area.querySelectorAll('.sheet').forEach(function (sh) {
    var box = sh.querySelector('.sh-secs');
    sh.classList.remove('sheet-long');
    var fit = false;
    for (var i = 0; i < sizes.length; i++) {
      sh.style.setProperty('--fs', sizes[i] + 'pt');
      if (box.scrollHeight <= box.clientHeight + 1) { fit = true; break; }
    }
    /* 가장 작은 글씨로도 넘치면 내용이 잘리지 않게 2쪽으로 이어서 출력 */
    if (!fit) { sh.style.setProperty('--fs', '9.5pt'); sh.classList.add('sheet-long'); }
  });
}

function printSheets(list) {
  if (!list.length) { toast('인쇄할 내용이 없어요.', 'err'); return; }
  var area = $('printArea');
  area.innerHTML = list.map(buildSheetHTML).join('');
  fitSheets(area);
  setTimeout(function () { window.print(); }, 80);
}
