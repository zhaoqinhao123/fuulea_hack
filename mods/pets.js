/* 灵宠：数量(≤4) / 种类(4 选 1) / 名字；等级由 earned 与 SEG_START 推算 */
(function () {
  var LIST = SPECIES.map(function (s) { return s.id + '=' + s.name; }).join(' / ');
  var n = parseInt(prompt('要几只灵宠？1-' + MAX_PETS + '（当前 ' + state.pets.length + ' 只）', String(MAX_PETS)), 10);
  if (isNaN(n) || n < 1 || n > MAX_PETS) return;

  var pets = [];
  for (var i = 0; i < n; i++) {
    var cur = state.pets[i] || {};
    var sp = prompt('第' + (i + 1) + '只种类：' + LIST, cur.sp || 'fox');
    if (sp === null) return;
    sp = sp.trim();
    if (!SPECIES.some(function (s) { return s.id === sp; })) return alert('种类无效：' + sp);
    var nm = prompt('第' + (i + 1) + '只名字', cur.name || '灵宠' + (i + 1));
    if (nm === null) return;
    pets.push({ sp: sp, name: nm, pts: 0 });
  }

  state.pets = pets;
  state.earned = Math.max(state.earned, SEG_START[n - 1] + PET_REQ[n - 1]);
  state.score = Math.max(state.score, state.earned);
  save();

  var el = document.getElementById('scoreTop');
  if (el) el.textContent = state.score;
  if (typeof renderHome === 'function') renderHome();
})();
