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
  var sPet = section('灵宠', '种类 / 姓名 / 等级 / 顺序。点「强」= 只改这一只，不动积分、不连带其它');

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

      // 等级：默认由 earned 反推（改一只会连带其它）；开了「强」就只改这一只的显示等级
      var hasSeg = i < SEG_START.length && i < PET_REQ.length;
      var forced = typeof p.fs === 'number';
      var st = document.createElement('select');
      st.style.cssText = 'width:74px;padding:8px;border:1px solid #333;border-radius:8px;background:#101014;color:#ddd;font:12px/1 inherit';
      var autoStage = (hasSeg && typeof petStage === 'function') ? petStage(i) : 0;
      var curStage = forced ? Math.min(p.fs, STAGE_NAMES.length - 1) : autoStage;
      if (hasSeg) {
        STAGE_NAMES.forEach(function (label, si) {
          var o = document.createElement('option');
          o.value = si;
          o.textContent = label;
          o.selected = si === curStage;
          st.append(o);
        });
        st.title = forced
          ? '强改中：只改这一只，不动总积分'
          : ('当前：' + STAGE_NAMES[curStage] + '（' + (SEG_START[i] || 0) + ' 起）');
        st.onchange = function () {
          var si = parseInt(st.value, 10) || 0;
          if (typeof p.fs === 'number') {
            p.fs = si;              // 强改：只写这一只，积分/其它灵宠不变
            drawPets();
            return;
          }
          var req = PET_REQ[i] || 0;
          var ratio = RATIOS[si] || 0;
          var need = (SEG_START[i] || 0) + Math.ceil(req * ratio);
          state.earned = need;
          // 必须跟积分同步：否则保存时 scoreIn 里的旧值会把 earned 盖回去，等级白改
          state.score = need;
          scoreIn.value = need;
          drawPets();
        };
      } else {
        var na = document.createElement('option');
        na.textContent = '无分级';
        st.append(na);
        st.disabled = true;
        st.title = '第 ' + (i + 1) + ' 只超出分段模型（只有前 ' + SEG_START.length + ' 只有等级）';
        st.style.opacity = '.5';
      }

      var fsBtn = document.createElement('button');
      fsBtn.textContent = '强';
      fsBtn.title = forced ? '强改中（点一下取消，回到按积分算）' : '强改：只改这一只的显示等级，不动总积分';
      fsBtn.style.cssText = 'width:28px;height:32px;border:1px solid ' + (forced ? '#3a6df0' : '#333') +
        ';border-radius:8px;background:' + (forced ? '#2b3f7a' : '#1c1c22') +
        ';color:' + (forced ? '#cfe0ff' : '#888') + ';font:12px/1 inherit;cursor:pointer';
      fsBtn.onclick = function () {
        if (typeof p.fs === 'number') delete p.fs;
        else p.fs = autoStage;
        drawPets();
      };

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

      row.append(sel, nm, st, fsBtn, up, delBtn(function () {
        state.pets.splice(i, 1);
        drawPets();
      }));
      sPet.append(row);
    });
    var ab = addBtn('＋ 添加一只', function () {
      if (typeof MAX_PETS === 'number' && state.pets.length >= MAX_PETS) return;
      state.pets.push({ sp: 'fox', name: '灵宠' + (state.pets.length + 1), pts: 0 });
      drawPets();
    });
    ab.dataset.row = '1';
    if (typeof MAX_PETS === 'number' && state.pets.length >= MAX_PETS) {
      ab.disabled = true;
      ab.textContent = '已达上限 ' + MAX_PETS + ' 只';
      ab.style.opacity = '.45';
      ab.style.cursor = 'default';
    }
    sPet.append(ab);
  }
  drawPets();

  body.append(sMe, sRank, sPet);
  root.append(bar, body);
  document.body.append(root);

  save.onclick = function () {
    var sc = parseInt(scoreIn.value, 10);
    var oldName = state.name;
    state.name = nameIn.value.trim();
    if (!isNaN(sc) && sc >= 0) { state.score = sc; state.earned = sc; }
    try { save(); } catch (e) {}
    try {
      // 把玩家当前分数同步进排行榜，避免名单里名字改了分数却对不上
      var hit = null;
      for (var i = 0; i < rankList.length; i++) if (rankList[i].name === oldName) { hit = rankList[i]; break; }
      if (!hit) for (var j = 0; j < rankList.length; j++) if (rankList[j].name === state.name) { hit = rankList[j]; break; }
      if (hit) {
        hit.name = state.name;
        hit.earned = state.earned;
        if (typeof hit.correct !== 'number') hit.correct = 0;
        if (typeof hit.rounds !== 'number') hit.rounds = 0;
      } else if (state.name) {
        rankList.push({ name: state.name, earned: state.earned, correct: 0, rounds: 0 });
      }
      if (typeof saveRank === 'function') saveRank(rankList);
    } catch (e) {}
    try { if (typeof renderHome === 'function') renderHome(); } catch (e) {}
    try { if (typeof renderRank === 'function') renderRank(); } catch (e) {}
    save.textContent = '已保存';
    setTimeout(function () { save.textContent = '保存'; }, 1200);
  };
})();
