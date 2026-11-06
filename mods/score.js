/* 改积分：score 是显示数字，earned 是灵宠等级/解锁依据，两个一起改 */
(function () {
  var v = prompt('设置积分（当前 ' + state.score + '）', '100000');
  if (v === null) return;
  var n = parseInt(v, 10);
  if (isNaN(n) || n < 0) return alert('请输入非负整数');

  state.score = n;
  state.earned = n;
  save();

  // 同步到排行榜，否则排名和分数对不上
  try {
    if (typeof loadRank === 'function' && typeof saveRank === 'function') {
      var list = loadRank();
      var me = null;
      for (var i = 0; i < list.length; i++) if (list[i].name === state.name) { me = list[i]; break; }
      if (me) me.earned = state.earned;
      else if (state.name) list.push({ name: state.name, earned: state.earned, correct: 0, rounds: 0 });
      saveRank(list);
    }
  } catch (e) {}

  var el = document.getElementById('scoreTop');
  if (el) el.textContent = n;
  if (typeof renderHome === 'function') renderHome();
  if (el) el.textContent = n;
})();
