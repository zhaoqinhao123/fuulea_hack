/* 突破 4 只上限：MAX_PETS 是 const 改不了，所以补 PET_REQ / SEG_START 后直接往 state.pets 塞 */
(function () {
  var n = parseInt(prompt('总共养几只？（当前 ' + state.pets.length + ' 只，UI 领养上限 4）', '6'), 10);
  if (isNaN(n) || n < 1) return;
  if (n > 24) n = 24;

  while (PET_REQ.length < n) PET_REQ.push(PET_REQ[PET_REQ.length - 1] + 100);
  while (SEG_START.length < n) SEG_START.push(SEG_START[SEG_START.length - 1] + PET_REQ[SEG_START.length - 1] + 100);

  var ids = SPECIES.map(function (s) { return s.id; });
  while (state.pets.length < n) {
    var i = state.pets.length;
    state.pets.push({ sp: ids[i % ids.length], name: '灵宠' + (i + 1), pts: 0 });
  }

  state.earned = Math.max(state.earned, SEG_START[n - 1] + PET_REQ[n - 1]);
  state.score = Math.max(state.score, state.earned);
  save();

  var el = document.getElementById('scoreTop');
  if (el) el.textContent = state.score;
  if (typeof renderHome === 'function') renderHome();

  alert('现在共 ' + state.pets.length + ' 只（UI 的「领养」按钮在满 4 只后会隐藏，属正常）');
})();
