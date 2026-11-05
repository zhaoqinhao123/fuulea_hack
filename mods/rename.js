/* 重置名字：玩家名清空 + 灵宠名改回 + 排行榜里带标签的记录洗掉 */
(function () {
  state.name = '';
  (state.pets || []).forEach(function (p, i) { p.name = '灵宠' + (i + 1); });
  save();

  try {
    if (typeof loadRank === 'function' && typeof saveRank === 'function') {
      saveRank(loadRank().map(function (r) {
        return Object.assign({}, r, { name: /[<>]/.test(r.name || '') ? '同学' : r.name });
      }));
    }
  } catch (e) {}

  if (typeof renderHome === 'function') renderHome();
  try { if (typeof renderRank === 'function') renderRank(); } catch (e) {}

  alert('名字已重置（玩家名 + 灵宠名 + 排行榜）');
})();
