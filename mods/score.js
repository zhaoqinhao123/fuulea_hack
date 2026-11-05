/* 改积分：score 是显示数字，earned 是灵宠等级/解锁依据，两个一起改 */
(function () {
  var v = prompt('设置积分（当前 ' + state.score + '）', '100000');
  if (v === null) return;
  var n = parseInt(v, 10);
  if (isNaN(n) || n < 0) return alert('请输入非负整数');

  state.score = n;
  state.earned = n;
  save();

  var el = document.getElementById('scoreTop');
  if (el) el.textContent = n;
  if (typeof renderHome === 'function') renderHome();
  if (el) el.textContent = n;
})();
