/* 清答案：删掉错题本里记录的答题原文（yourAns），题目本身保留 */
(function () {
  var n = 0;
  Object.keys(state.wrong || {}).forEach(function (k) {
    var q = state.wrong[k];
    if (!q) return;
    if (q.yourAns !== undefined && q.yourAns !== null && q.yourAns !== '') n++;
    delete q.yourAns;
  });
  save();

  try { if (typeof renderWrong === 'function') renderWrong(); } catch (e) {}
  alert('已清除 ' + n + ' 条答题原文（题目保留）');
})();
