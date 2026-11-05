/* 解锁第 4 只：补满 fillDone（填空题进度）+ 积分够 SEG_START[3] */
(function () {
  var have = Object.keys(state.fillDone || {}).length;
  var add = Math.max(0, FILL_TOTAL - have);
  for (var i = 0; i < FILL_TOTAL; i++) state.fillDone['x' + i] = 1;

  state.earned = Math.max(state.earned, SEG_START[3]);
  state.score = Math.max(state.score, state.earned);
  save();

  var el = document.getElementById('scoreTop');
  if (el) el.textContent = state.score;
  if (typeof renderHome === 'function') renderHome();

  alert('填空题进度 ' + Object.keys(state.fillDone).length + '/' + FILL_TOTAL +
    '（补了 ' + add + ' 条）\n累计积分 ' + state.earned + '，可以领第 4 只了');
})();
