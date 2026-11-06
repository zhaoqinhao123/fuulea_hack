/* 名单编辑：玩家名/分数、排行榜、灵宠（种类·姓名·顺序）一次性改完 */
(function () {
  if (document.getElementById('__ed')) { document.getElementById('__ed').remove(); return; }

  var root = document.createElement('div');
  root.id = '__ed';
  root.style.cssText = 'position:fixed;inset:0;z-index:2147483645;background:#111114;display:flex;flex-direction:column;color:#ddd;font:13px/1.5 -apple-system,"PingFang SC",sans-serif';

  var bar = document.createElement('div');
  bar.style.cssText = 'display:flex;align-items:center;gap:8px;padding:10px 12px;background:#1b1b20;border-bottom:1px solid #2c2c34;flex-shrink:0';
  var t = document.createElement('div');
  t.textContent = '名单编辑';
  t.style.cssText = 'flex:1;font-weight:700;color:#bbb';
  var save = document.createElement('button');
  save.textContent = '保存';
  save.style.cssText = 'height:36px;padding:0 16px;border:0;border-radius:9px;background:#3a6df0;color:#fff;font:13px/1 inherit;cursor:pointer';
  var x = document.createElement('button');
  x.textContent = '✕';
  x.style.cssText = 'width:36px;height:36px;border:0;border-radius:9px;background:transparent;color:#999;font-size:16px;cursor:pointer';
  x.onclick = function () { root.remove(); };
  bar.append(t, save, x);

  var body = document.createElement('div');
  body.style.cssText = 'flex:1;overflow:auto;padding:12px;display:flex;flex-direction:column;gap:16px';

  function section(title, hint) {
    var s = document.createElement('div');
    s.style.cssText = 'background:#17171c;border:1px solid #2c2c34;border-radius:12px;padding:10px';
    var h = document.createElement('div');
    h.textContent = title;
    h.style.cssText = 'font-weight:700;color:#aaa;margin-bottom:8px';
    s.append(h);
    if (hint) {
      var p = document.createElement('div');
      p.textContent = hint;
      p.style.cssText = 'font-size:11px;color:#666;margin:-4px 0 8px';
      s.append(p);
    }
    return s;
  }

  function input(val, ph, w) {
    var i = document.createElement('input');
    i.value = val == null ? '' : val;
    i.placeholder = ph || '';
    i.style.cssText = 'width:' + (w || '100%') + ';box-sizing:border-box;padding:8px;border:1px solid #333;border-radius:8px;background:#101014;color:#ddd;font:12px/1.4 inherit;outline:none';
    return i;
  }

  function delBtn(fn) {
    var b = document.createElement('button');
    b.textContent = '✕';
    b.style.cssText = 'width:30px;height:32px;border:0;border-radius:8px;background:#2a1c1c;color:#d66;font:12px/1 inherit;cursor:pointer';
    b.onclick = fn;
    return b;
  }

  function addBtn(txt, fn) {
    var b = document.createElement('button');
    b.textContent = txt;
    b.style.cssText = 'margin-top:8px;width:100%;height:34px;border:1px dashed #3a3a42;border-radius:9px;background:transparent;color:#888;font:12px/1 inherit;cursor:pointer';
    b.onclick = fn;
    return b;
  }

  // ── 玩家 ──
  var sMe = section('玩家');
  var rowMe = document.createElement('div');
  rowMe.style.cssText = 'display:flex;gap:8px';
  var nameIn = input(state.name || '', '名字');
  var scoreIn = input(state.score, '分数');
  scoreIn.style.width = '90px';
  scoreIn.inputMode = 'numeric';
  rowMe.append(nameIn, scoreIn);
  sMe.append(rowMe);

  // ── 排行榜 ──
  var sRank = section('排行榜', '改完点右上角「保存」写入本机排行榜');
  var rankBox = document.createElement('div');
  var rankList = [];
  try { rankList = (typeof loadRank === 'function' ? loadRank() : []).slice(); } catch (e) { rankList = []; }

  function drawRank() {
    rankBox.innerHTML = '';
    rankList.forEach(function (r, i) {
      var row = document.createElement('div');
      row.style.cssText = 'display:flex;gap:6px;align-items:center;margin-bottom:6px';
      var n = input(r.name || '', '名字');
      var s = input(r.earned != null ? r.earned : 0, '分');
      s.style.width = '84px';
      s.inputMode = 'numeric';
      n.oninput = function () { r.name = n.value; };
      s.oninput = function () { r.earned = parseInt(s.value, 10) || 0; };
      row.append(n, s, delBtn(function () { rankList.splice(i, 1); drawRank(); }));
      rankBox.append(row);
    });
    rankBox.append(addBtn('＋ 添加一条', function () {
      rankList.push({ name: '新同学', earned: 0, correct: 0, rounds: 0 });
      drawRank();
    }));
  }
  drawRank();
  sRank.append(rankBox);

  // ── 灵宠 ──
  var sPet = section('灵宠', '种类 / 姓名 / 顺序（↑↓ 调整）');

  function drawPets() {
    sPet.querySelectorAll('[data-row]').forEach(function (n) { n.remove(); });
    state.pets.forEach(function (p, i) {
      var row = document.createElement('div');
      row.dataset.row = '1';
      row.style.cssText = 'display:flex;gap:6px;align-items:center;margin-bottom:6px';

      var sel = document.createElement('select');
      sel.style.cssText = 'width:86px;padding:8px;border:1px solid #333;border-radius:8px;background:#101014;color:#ddd;font:12px/1 inherit';
      SPECIES.forEach(function (s) {
        var o = document.createElement('option');
        o.value = s.id;
        o.textContent = s.name;
        o.selected = s.id === p.sp;
        sel.append(o);
      });
      sel.onchange = function () { p.sp = sel.value; };

      var nm = input(p.name || '', '名字');
      nm.oninput = function () { p.name = nm.value; };

      var up = document.createElement('button');
      up.textContent = '↑';
      up.style.cssText = 'width:30px;height:32px;border:1px solid #333;border-radius:8px;background:#1c1c22;color:#aaa;cursor:pointer';
      up.onclick = function () {
        if (i === 0) return;
        var tmp = state.pets[i - 1];
        state.pets[i - 1] = state.pets[i];
        state.pets[i] = tmp;
        drawPets();
      };

      row.append(sel, nm, up, delBtn(function () {
        state.pets.splice(i, 1);
        drawPets();
      }));
      sPet.append(row);
    });
    sPet.append(addBtn('＋ 添加一只', function () {
      state.pets.push({ sp: 'fox', name: '灵宠' + (state.pets.length + 1), pts: 0 });
      drawPets();
    }));
  }
  drawPets();

  body.append(sMe, sRank, sPet);
  root.append(bar, body);
  document.body.append(root);

  save.onclick = function () {
    var sc = parseInt(scoreIn.value, 10);
    state.name = nameIn.value.trim();
    if (!isNaN(sc) && sc >= 0) { state.score = sc; state.earned = sc; }
    try { save(); } catch (e) {}
    try { if (typeof saveRank === 'function') saveRank(rankList); } catch (e) {}
    try { if (typeof renderHome === 'function') renderHome(); } catch (e) {}
    try { if (typeof renderRank === 'function') renderRank(); } catch (e) {}
    save.textContent = '已保存';
    setTimeout(function () { save.textContent = '保存'; }, 1200);
  };
})();
