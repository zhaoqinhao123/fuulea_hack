/* 灵宠图片：页面原生支持 PET_IMG[种类_阶段] 覆盖 8 个阶段的图 */
(function () {
  var sp = prompt('改哪种灵宠的图？fox / qilin / cat / dog（留空 = 全部）', 'fox');
  if (sp === null) return;
  sp = sp.trim();

  var all = !sp;
  if (!all && !SPECIES.some(function (s) { return s.id === sp; })) return alert('种类无效：' + sp);

  var url = prompt('图片直链（直接回车 = 恢复默认手绘图）', 'https://');
  if (url === null) return;
  url = url.trim();
  var reset = (!url || url === 'https://');

  var n = 0;
  (all ? SPECIES.map(function (s) { return s.id; }) : [sp]).forEach(function (id) {
    for (var st = 0; st < 8; st++) {
      var k = id + '_' + st;
      if (reset) delete PET_IMG[k];
      else PET_IMG[k] = url;
      n++;
    }
  });

  if (typeof renderHome === 'function') renderHome();
  alert('已' + (reset ? '恢复默认图' : '替换') + ' ' + n + ' 张（8 阶段 × ' + (all ? '4 种' : '1 种') + '）');
})();
