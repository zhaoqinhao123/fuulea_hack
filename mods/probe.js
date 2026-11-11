/* 探测：把浏览器允许网页调用的硬件/权限/外部 App 能力集中成按钮。
   注意：网页不能枚举已安装软件，也不能绕过系统权限弹窗；每个按钮都会真实发起请求，
   结果只代表这个浏览器给不给，不代表设备一定没有该能力。 */
(function () {
  'use strict';
  var old = document.getElementById('__probe');
  if (old) { old.remove(); return; }

  var root = document.createElement('div');
  root.id = '__probe';
  root.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:rgba(5,5,8,.68);' +
    'display:flex;align-items:center;justify-content:center;padding:12px;' +
    'font:13px/1.55 -apple-system,"PingFang SC","Microsoft YaHei",sans-serif;color:#e6e6ef';

  var card = document.createElement('div');
  card.style.cssText = 'width:min(760px,96vw);height:min(84vh,780px);display:flex;flex-direction:column;' +
    'background:#17171c;border:1px solid #35353f;border-radius:16px;overflow:hidden;' +
    'box-shadow:0 24px 80px rgba(0,0,0,.65)';

  var head = document.createElement('div');
  head.style.cssText = 'display:flex;align-items:center;gap:10px;padding:12px 14px;' +
    'border-bottom:1px solid #2c2c34;background:#1d1d23;flex:0 0 auto';
  var title = document.createElement('div');
  title.innerHTML = '<b style="font-size:15px">🧭 探测</b>' +
    '<span style="color:#777;margin-left:8px;font-size:12px">设备 · 权限 · 外部 App</span>';
  title.style.cssText = 'flex:1;min-width:0';
  var close = document.createElement('button');
  close.type = 'button';
  close.textContent = '✕';
  close.title = '关闭';
  close.style.cssText = 'width:34px;height:34px;border:0;border-radius:9px;background:transparent;' +
    'color:#999;font:17px/1 inherit;cursor:pointer';
  close.onclick = function () { root.remove(); };
  head.append(title, close);

  var body = document.createElement('div');
  body.style.cssText = 'flex:1;overflow:auto;padding:12px 14px 18px;overscroll-behavior:contain';

  var status = document.createElement('div');
  status.style.cssText = 'position:sticky;top:-12px;z-index:3;margin:0 -14px 10px;padding:8px 14px;' +
    'background:rgba(23,23,28,.96);border-bottom:1px solid #2a2a32;color:#8f8f9f;font-size:12px;' +
    'backdrop-filter:blur(8px)';
  status.textContent = '点下面的按钮会真实请求对应权限；浏览器不给的会直接标红。';
  body.append(status);

  function log(msg, ok) {
    status.textContent = msg;
    status.style.color = ok === true ? '#67d47a' : (ok === false ? '#ff8a8a' : '#8f8f9f');
  }
  function errText(e) {
    if (!e) return '未知错误';
    return (e.name ? e.name + '：' : '') + (e.message || String(e));
  }
  function requireSecure() {
    if (!window.isSecureContext) {
      log('当前不是安全上下文（https/localhost），浏览器会禁用大部分硬件 API。', false);
      return false;
    }
    return true;
  }
  function makeBtn(label, hint, fn) {
    var b = document.createElement('button');
    b.type = 'button';
    b.style.cssText = 'display:flex;flex-direction:column;align-items:flex-start;gap:2px;text-align:left;' +
      'min-height:52px;padding:8px 10px;border:1px solid #35353f;border-radius:10px;' +
      'background:#202027;color:#ddd;font:13px/1.35 inherit;cursor:pointer;transition:border-color .15s,background .15s';
    b.onmouseenter = function () { b.style.borderColor = '#4d6fa8'; b.style.background = '#24242d'; };
    b.onmouseleave = function () { b.style.borderColor = '#35353f'; b.style.background = '#202027'; };
    var t = document.createElement('span');
    t.textContent = label;
    t.style.cssText = 'font-weight:600;color:#e8e8f0';
    var h = document.createElement('span');
    h.textContent = hint;
    h.style.cssText = 'font-size:11px;color:#7f7f8d;white-space:normal';
    b.append(t, h);
    b.onclick = function () {
      b.disabled = true;
      b.style.opacity = '.6';
      log('正在请求：' + label + ' …');
      Promise.resolve().then(fn).then(function (msg) {
        log('✅ ' + label + '：' + (msg || '完成'), true);
      }).catch(function (e) {
        log('❌ ' + label + '：' + errText(e), false);
      }).then(function () {
        b.disabled = false;
        b.style.opacity = '1';
      });
    };
    return b;
  }
  function group(name, desc) {
    var box = document.createElement('section');
    box.style.cssText = 'margin:0 0 14px';
    var h = document.createElement('div');
    h.innerHTML = '<span style="font-weight:700;color:#cfcfdb">' + name + '</span>' +
      (desc ? '<span style="color:#6f6f7e;font-size:11px;margin-left:8px">' + desc + '</span>' : '');
    h.style.cssText = 'margin:0 0 7px;font-size:12px';
    var grid = document.createElement('div');
    grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:8px';
    box.append(h, grid);
    body.append(box);
    return grid;
  }
  function infoGrid(pairs) {
    var box = document.createElement('div');
    box.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:6px 12px;' +
      'padding:9px 11px;border:1px solid #2d2d36;border-radius:10px;background:#1b1b21;font-size:12px';
    pairs.forEach(function (p) {
      var d = document.createElement('div');
      d.innerHTML = '<span style="color:#777785">' + p[0] + '</span> ' +
        '<span style="color:#c9c9d4;word-break:break-all">' + p[1] + '</span>';
      box.append(d);
    });
    body.append(box);
    return box;
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c];
    });
  }

  // ── 权限状态快照 ──
  var permGrid = group('权限状态', '浏览器当前记录的授权状态');
  var permNames = [
    ['camera', '摄像头'], ['microphone', '麦克风'], ['geolocation', '定位'],
    ['notifications', '通知'], ['clipboard-read', '读剪贴板'], ['clipboard-write', '写剪贴板'],
    ['persistent-storage', '持久存储'], ['midi', 'MIDI'], ['screen-wake-lock', '屏幕常亮'],
    ['accelerometer', '加速度计'], ['gyroscope', '陀螺仪'], ['magnetometer', '磁力计'],
    ['background-sync', '后台同步'], ['storage-access', '存储访问'], ['window-management', '多窗口'],
    ['local-fonts', '本地字体']
  ];
  if (!navigator.permissions || !navigator.permissions.query) {
    permGrid.innerHTML = '<div style="color:#888;font-size:12px;grid-column:1/-1">此浏览器不支持 Permissions API</div>';
  } else {
    permNames.forEach(function (p) {
      var chip = document.createElement('div');
      chip.textContent = p[1] + ' · 查询中';
      chip.style.cssText = 'padding:7px 9px;border:1px solid #303038;border-radius:8px;background:#1d1d23;' +
        'font-size:12px;color:#858594';
      permGrid.append(chip);
      navigator.permissions.query({ name: p[0] }).then(function (st) {
        var color = st.state === 'granted' ? '#67d47a' : (st.state === 'denied' ? '#ff8a8a' : '#e0b85c');
        chip.textContent = p[1] + ' · ' + st.state;
        chip.style.color = color;
        st.onchange = function () {
          chip.textContent = p[1] + ' · ' + st.state;
          chip.style.color = st.state === 'granted' ? '#67d47a' : (st.state === 'denied' ? '#ff8a8a' : '#e0b85c');
        };
      }).catch(function () {
        chip.textContent = p[1] + ' · 不支持';
        chip.style.color = '#5f5f6b';
      });
    });
  }

  // ── 摄像头 / 麦克风 / 定位 ──
  var media = group('媒体与定位', '请求后会立刻释放设备');
  media.append(
    makeBtn('📷 摄像头', 'getUserMedia video', function () {
      if (!requireSecure()) throw new Error('需要 HTTPS/localhost');
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('不支持 getUserMedia');
      return navigator.mediaDevices.getUserMedia({ video: true, audio: false }).then(function (s) {
        var n = s.getVideoTracks().length;
        s.getTracks().forEach(function (t) { t.stop(); });
        return '已授权，' + n + ' 路视频轨（已释放）';
      });
    }),
    makeBtn('🎙 麦克风', 'getUserMedia audio', function () {
      if (!requireSecure()) throw new Error('需要 HTTPS/localhost');
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('不支持 getUserMedia');
      return navigator.mediaDevices.getUserMedia({ audio: true, video: false }).then(function (s) {
        var n = s.getAudioTracks().length;
        s.getTracks().forEach(function (t) { t.stop(); });
        return '已授权，' + n + ' 路音频轨（已释放）';
      });
    }),
    makeBtn('📍 定位', 'getCurrentPosition 高精度', function () {
      if (!navigator.geolocation) throw new Error('不支持 Geolocation');
      return new Promise(function (res, rej) {
        navigator.geolocation.getCurrentPosition(function (p) {
          res('纬度 ' + p.coords.latitude.toFixed(5) + '，经度 ' + p.coords.longitude.toFixed(5) +
            '，精度 ' + Math.round(p.coords.accuracy) + 'm');
        }, rej, { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 });
      });
    }),
    makeBtn('🎥 屏幕共享', 'getDisplayMedia 选择窗口/屏幕', function () {
      if (!requireSecure()) throw new Error('需要 HTTPS/localhost');
      if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) throw new Error('不支持 getDisplayMedia');
      return navigator.mediaDevices.getDisplayMedia({ video: true, audio: false }).then(function (s) {
        var n = s.getVideoTracks().length;
        s.getTracks().forEach(function (t) { t.stop(); });
        return '已选择共享源，' + n + ' 路视频轨（已释放）';
      });
    })
  );

  // ── 文件、剪贴板、分享、联系人 ──
  var files = group('文件与数据', '文件选择必须由点击触发');
  files.append(
    makeBtn('📂 打开文件', 'showOpenFilePicker', function () {
      if (window.showOpenFilePicker) {
        return window.showOpenFilePicker({ multiple: true }).then(function (hs) {
          return '选择了 ' + hs.length + ' 个文件：' + hs.map(function (h) { return h.name; }).join('、');
        });
      }
      return new Promise(function (res) {
        var i = document.createElement('input');
        i.type = 'file'; i.multiple = true;
        i.onchange = function () { res('选择了 ' + (i.files ? i.files.length : 0) + ' 个文件'); };
        i.click();
      });
    }),
    makeBtn('💾 保存文件', 'showSaveFilePicker / 下载', function () {
      var blob = new Blob(['fuulea probe\n' + new Date().toISOString()], { type: 'text/plain' });
      if (window.showSaveFilePicker) {
        return window.showSaveFilePicker({ suggestedName: 'probe.txt' }).then(function (h) {
          return h.createWritable().then(function (w) {
            return w.write(blob).then(function () { return w.close(); }).then(function () { return '已保存 probe.txt'; });
          });
        });
      }
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'probe.txt';
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 3000);
      return Promise.resolve('已触发下载 probe.txt');
    }),
    makeBtn('🗂 选择文件夹', 'showDirectoryPicker', function () {
      if (!window.showDirectoryPicker) throw new Error('不支持 File System Access');
      return window.showDirectoryPicker().then(function (h) { return '已选择目录：' + h.name; });
    }),
    makeBtn('📋 读剪贴板', 'clipboard.readText', function () {
      if (!navigator.clipboard || !navigator.clipboard.readText) throw new Error('不支持 Clipboard API');
      return navigator.clipboard.readText().then(function (t) {
        return t ? '读到 ' + t.length + ' 字：' + t.slice(0, 80) : '剪贴板为空';
      });
    }),
    makeBtn('📋 写剪贴板', 'clipboard.writeText', function () {
      if (!navigator.clipboard || !navigator.clipboard.writeText) throw new Error('不支持 Clipboard API');
      return navigator.clipboard.writeText('fuulea probe ' + new Date().toLocaleString())
        .then(function () { return '已写入一段测试文本'; });
    }),
    makeBtn('📤 系统分享', 'navigator.share', function () {
      if (!navigator.share) throw new Error('不支持 Web Share');
      return navigator.share({ title: 'Fuulea 探测', text: '来自网页的分享测试', url: location.href })
        .then(function () { return '已调起系统分享面板'; });
    }),
    makeBtn('👤 选择联系人', 'navigator.contacts.select', function () {
      if (!navigator.contacts || !navigator.contacts.select) throw new Error('不支持 Contact Picker');
      return navigator.contacts.select(['name', 'tel'], { multiple: true }).then(function (list) {
        return '选择了 ' + list.length + ' 个联系人';
      });
    })
  );

  // ── 系统能力 ──
  var sys = group('系统与传感器', '部分 API 仅 Android/Chrome 可用');
  sys.append(
    makeBtn('⛶ 全屏', 'requestFullscreen', function () {
      if (!card.requestFullscreen) throw new Error('不支持全屏');
      return card.requestFullscreen().then(function () { return '已进入全屏，按 Esc 退出'; });
    }),
    makeBtn('💡 保持常亮', 'Screen Wake Lock', function () {
      if (!navigator.wakeLock) throw new Error('不支持 Wake Lock');
      return navigator.wakeLock.request('screen').then(function (s) {
        setTimeout(function () { try { s.release(); } catch (e) {} }, 8000);
        return '已拿到屏幕常亮锁，8 秒后自动释放';
      });
    }),
    makeBtn('📳 振动', 'navigator.vibrate', function () {
      if (!navigator.vibrate) throw new Error('不支持振动');
      return navigator.vibrate([120, 60, 120]) ? Promise.resolve('已发送振动指令') : Promise.reject(new Error('被系统拒绝'));
    }),
    makeBtn('🔔 通知', 'Notification.requestPermission', function () {
      if (!window.Notification) throw new Error('不支持通知');
      return Notification.requestPermission().then(function (p) {
        if (p !== 'granted') throw new Error('权限结果：' + p);
        new Notification('Fuulea 探测', { body: '通知通道正常' });
        return '已授权并发送测试通知';
      });
    }),
    makeBtn('🧭 设备方向', 'DeviceOrientation 权限', function () {
      if (!window.DeviceOrientationEvent) throw new Error('不支持 DeviceOrientation');
      if (typeof DeviceOrientationEvent.requestPermission === 'function') {
        return DeviceOrientationEvent.requestPermission().then(function (p) {
          if (p !== 'granted') throw new Error('权限结果：' + p);
          return '已授权设备方向';
        });
      }
      return Promise.resolve('无需显式授权（或浏览器直接允许）');
    }),
    makeBtn('🏃 运动传感器', 'DeviceMotion 权限', function () {
      if (!window.DeviceMotionEvent) throw new Error('不支持 DeviceMotion');
      if (typeof DeviceMotionEvent.requestPermission === 'function') {
        return DeviceMotionEvent.requestPermission().then(function (p) {
          if (p !== 'granted') throw new Error('权限结果：' + p);
          return '已授权运动传感器';
        });
      }
      return Promise.resolve('无需显式授权（或浏览器直接允许）');
    }),
    makeBtn('💡 环境光', 'AmbientLightSensor', function () {
      if (!window.AmbientLightSensor) throw new Error('不支持 AmbientLightSensor');
      var s = new AmbientLightSensor();
      return s.start().then(function () { return '环境光传感器已启动'; });
    }),
    makeBtn('🌀 陀螺仪', 'Gyroscope', function () {
      if (!window.Gyroscope) throw new Error('不支持 Gyroscope');
      var s = new Gyroscope({ frequency: 10 });
      return s.start().then(function () { return '陀螺仪已启动'; });
    }),
    makeBtn('🔒 锁定横屏', 'screen.orientation.lock', function () {
      if (!screen.orientation || !screen.orientation.lock) throw new Error('不支持方向锁定');
      return screen.orientation.lock('landscape').then(function () { return '已请求横屏（全屏时才生效）'; });
    }),
    makeBtn('🔋 电池', 'getBattery', function () {
      if (!navigator.getBattery) throw new Error('不支持 Battery Status');
      return navigator.getBattery().then(function (b) {
        return '电量 ' + Math.round(b.level * 100) + '%，' + (b.charging ? '充电中' : '未充电');
      });
    }),
    makeBtn('📶 网络信息', 'navigator.connection', function () {
      var c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      if (!c) throw new Error('不支持 Network Information');
      return Promise.resolve('类型 ' + (c.effectiveType || '?') + '，下行 ' + (c.downlink || '?') +
        ' Mbps，RTT ' + (c.rtt || '?') + ' ms');
    }),
    makeBtn('🛰 空闲检测', 'IdleDetector', function () {
      if (!window.IdleDetector) throw new Error('不支持 IdleDetector');
      return IdleDetector.requestPermission().then(function (p) {
        if (p !== 'granted') throw new Error('权限结果：' + p);
        return '已授权空闲检测';
      });
    }),
    makeBtn('🗣 语音朗读', 'speechSynthesis', function () {
      if (!window.speechSynthesis) throw new Error('不支持语音合成');
      var u = new SpeechSynthesisUtterance('探测正常');
      u.lang = 'zh-CN';
      speechSynthesis.speak(u);
      return Promise.resolve('已朗读“探测正常”');
    })
  );

  // ── 近距离无线 ──
  var radio = group('近距离无线', '需要 HTTPS，且会弹出设备选择器');
  radio.append(
    makeBtn('🔵 蓝牙', 'bluetooth.requestDevice', function () {
      if (!navigator.bluetooth) throw new Error('不支持 Web Bluetooth');
      return navigator.bluetooth.requestDevice({ acceptAllDevices: true }).then(function (d) {
        return '已选择：' + (d.name || d.id);
      });
    }),
    makeBtn('🔌 USB', 'usb.requestDevice', function () {
      if (!navigator.usb) throw new Error('不支持 WebUSB');
      return navigator.usb.requestDevice({ filters: [] }).then(function (d) {
        return '已选择：' + (d.productName || d.vendorId);
      });
    }),
    makeBtn('🔗 串口', 'serial.requestPort', function () {
      if (!navigator.serial) throw new Error('不支持 Web Serial');
      return navigator.serial.requestPort().then(function () { return '已选择串口设备'; });
    }),
    makeBtn('🖱 HID', 'hid.requestDevice', function () {
      if (!navigator.hid) throw new Error('不支持 WebHID');
      return navigator.hid.requestDevice({ filters: [] }).then(function (list) {
        return '已选择 ' + list.length + ' 个 HID 设备';
      });
    }),
    makeBtn('🎹 MIDI', 'requestMIDIAccess', function () {
      if (!navigator.requestMIDIAccess) throw new Error('不支持 Web MIDI');
      return navigator.requestMIDIAccess().then(function (a) {
        return 'MIDI 输入 ' + a.inputs.size + ' 个，输出 ' + a.outputs.size + ' 个';
      });
    }),
    makeBtn('📡 NFC', 'NDEFReader.scan', function () {
      if (!window.NDEFReader) throw new Error('不支持 Web NFC');
      return new NDEFReader().scan().then(function () { return 'NFC 扫描已启动'; });
    })
  );

  // ── 外部 App ──
  var appGrid = group('外部 App', '通过 URI Scheme 尝试唤起；未安装时通常没反应');
  [
    ['📞 电话', 'tel:10086'],
    ['💬 短信', 'sms:10086'],
    ['✉️ 邮件', 'mailto:test@example.com'],
    ['🗺 地图', 'geo:39.9042,116.4074'],
    ['💚 微信', 'weixin://'],
    ['💙 支付宝', 'alipays://'],
    ['🛒 淘宝', 'taobao://'],
    ['📺 哔哩哔哩', 'bilibili://'],
    ['🔵 知乎', 'zhihu://'],
    ['🎵 抖音', 'snssdk1128://'],
    ['☁️ 百度网盘', 'baiduyun://'],
    ['🐧 QQ', 'mqq://'],
    ['🔴 微博', 'weibo://'],
    ['🚕 高德', 'androidamap://']
  ].forEach(function (a) {
    var b = document.createElement('button');
    b.type = 'button';
    b.textContent = a[0];
    b.title = a[1];
    b.style.cssText = 'height:38px;padding:0 12px;border:1px solid #35353f;border-radius:9px;' +
      'background:#202027;color:#dcdce6;font:12px/1 inherit;cursor:pointer';
    b.onclick = function () {
      log('正在尝试唤起 ' + a[0] + ' … 若没反应说明未安装或被浏览器拦截。');
      try { location.href = a[1]; } catch (e) { log('❌ 唤起失败：' + errText(e), false); }
    };
    appGrid.append(b);
  });

  // ── 环境信息 ──
  var env = group('当前环境', '只读信息');
  var gl = '';
  try {
    var cv = document.createElement('canvas');
    var g = cv.getContext('webgl') || cv.getContext('experimental-webgl');
    if (g) {
      var dbg = g.getExtension('WEBGL_debug_renderer_info');
      gl = dbg ? (g.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || '') : 'WebGL';
    }
  } catch (e) {}
  infoGrid([
    ['安全上下文', window.isSecureContext ? '是' : '否（file:// 会限制硬件 API）'],
    ['协议', location.protocol],
    ['UA', esc(navigator.userAgent)],
    ['平台', esc(navigator.platform || '?')],
    ['CPU 核心', navigator.hardwareConcurrency || '?'],
    ['设备内存', navigator.deviceMemory ? navigator.deviceMemory + ' GB' : '未暴露'],
    ['屏幕', screen.width + '×' + screen.height + ' @' + (window.devicePixelRatio || 1) + 'x'],
    ['语言', navigator.language || '?'],
    ['在线', navigator.onLine ? '是' : '否'],
    ['GPU', esc(gl || '未暴露')]
  ]);

  card.append(head, body);
  root.append(card);
  root.onclick = function (e) { if (e.target === root) root.remove(); };
  document.body.append(root);
})();
