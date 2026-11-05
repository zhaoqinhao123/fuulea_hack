/* 清空存档：只清学习数据，不动家长密码设置（wycg_lock_v1） */
(function () {
  if (!confirm('清空全部学习数据？\n积分 / 灵宠 / 错题 / 收藏 / 排行榜都会没。')) return;
  ['wycg_v3', 'wycg_rank_v1'].forEach(function (k) { localStorage.removeItem(k); });
  location.reload();
})();
