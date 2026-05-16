(function () {
  const CFG = window.SCS_CONFIG;
  let towers = [];
  let selectedId = null;
  let commandHistory = [];
  let cctvHls = null;

  const $ = (id) => document.getElementById(id);

  function riskClass(risk) {
    if (risk === 'Evacuation') return 'evac';
    if (risk === 'Battery Warning') return 'warn';
    if (risk === 'Offline') return 'offline';
    return 'normal';
  }

  function computeRisk(t) {
    if (!t.online) return 'Offline';
    if (t.emergencyActive) return 'Evacuation';
    const pct = t.battery?.percent ?? t.battery;
    if (pct < 25) return 'Battery Warning';
    return 'Normal';
  }

  function formatSignal(sig) {
    if (!sig || sig.rssi == null || sig.rssi === '') {
      return { text: '—', sub: 'No RSSI — enable RUT or check Pi Wi‑Fi', bars: 0 };
    }
    const rssi = Number(sig.rssi);
    const quality =
      rssi >= -60 ? 'Excellent' : rssi >= -70 ? 'Good' : rssi >= -80 ? 'Fair' : 'Weak';
    const bars = rssi >= -60 ? 4 : rssi >= -70 ? 3 : rssi >= -80 ? 2 : 1;
    const net = sig.operator || sig.network || sig.source || 'link';
    return { text: `${rssi} dBm`, sub: `${quality} · ${net}`, bars, rssi };
  }

  function renderSignalBars(container, bars, rssi) {
    if (!container) return;
    const level =
      rssi == null ? '' : rssi >= -70 ? 'on' : rssi >= -85 ? 'warn' : 'weak';
    container.innerHTML = [1, 2, 3, 4]
      .map((i) => {
        const h = 6 + i * 4;
        const on = i <= bars ? level : '';
        return `<span class="${on}" style="height:${h}px"></span>`;
      })
      .join('');
  }

  function formatLastSeen(iso) {
    if (!iso) return 'Never';
    const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (sec < 60) return `${sec} sec ago`;
    if (sec < 3600) return `${Math.floor(sec / 60)} min ago`;
    return `${Math.floor(sec / 3600)} hr ago`;
  }

  function streamKind(url) {
    if (!url) return 'none';
    const u = url.toLowerCase();
    if (u.startsWith('rtsp://')) return 'rtsp';
    if (u.includes('stream.html') || u.includes('/api/ws') || u.includes('go2rtc')) return 'embed';
    if (u.includes('mjpeg') || u.includes('mjpg') || u.includes('/video') || u.includes('axis-cgi')) {
      return 'mjpeg';
    }
    if (u.includes('.m3u8')) return 'hls';
    if (/\.(mp4|webm)(\?|$)/i.test(u)) return 'video';
    if (u.startsWith('http://') || u.startsWith('https://')) return 'http';
    return 'unknown';
  }

  function destroyCctvHls() {
    if (cctvHls) {
      cctvHls.destroy();
      cctvHls = null;
    }
  }

  function attachHlsPlayback(video, url) {
    destroyCctvHls();
    if (window.Hls && window.Hls.isSupported()) {
      cctvHls = new window.Hls();
      cctvHls.loadSource(url);
      cctvHls.attachMedia(video);
      return;
    }
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = url;
      return;
    }
    video.insertAdjacentHTML(
      'afterend',
      '<p class="muted" style="padding:8px">HLS playback not supported in this browser.</p>'
    );
  }

  function renderCctvBox(t) {
    destroyCctvHls();
    const url = t.streamUrl || CFG.DEFAULT_CAMERA_STREAM || '';
    const input = $('cameraUrl');
    if (input && document.activeElement !== input) input.value = url;

    if (!url) {
      $('cctvBox').innerHTML = `<div class="cctv-placeholder">
         <div class="camera-icon">📵</div>
         <b>No camera URL</b><br /><span class="muted">Paste a stream URL below and click Load feed</span>
       </div>`;
      return;
    }

    const kind = streamKind(url);
    const esc = url.replace(/"/g, '&quot;');
    let media = '';

    if (kind === 'rtsp') {
      $('cctvBox').innerHTML = `<div class="live">RTSP</div>
        <div class="cctv-placeholder">
          <b>RTSP URL saved</b><br />
          <span class="muted">Browsers cannot play rtsp:// directly.</span><br />
          <span class="muted" style="font-size:12px;word-break:break-all">${esc}</span><br /><br />
          <span class="muted">Use go2rtc on your PC, then paste its <code>stream.html</code> URL here.</span>
        </div>`;
      return;
    }
    if (kind === 'embed') {
      media = `<iframe class="cctv-stream" src="${esc}" title="CCTV" allow="autoplay; fullscreen"></iframe>`;
    } else if (kind === 'mjpeg' || kind === 'http') {
      media = `<img class="cctv-stream" src="${esc}" alt="CCTV live" />`;
    } else if (kind === 'hls') {
      $('cctvBox').innerHTML =
        '<div class="live">● LIVE</div><video id="cctvVideo" class="cctv-stream" autoplay muted playsinline controls></video>';
      const video = $('cctvVideo');
      if (video) attachHlsPlayback(video, url);
      return;
    } else if (kind === 'video') {
      media = `<video class="cctv-stream" src="${esc}" autoplay muted playsinline controls></video>`;
    } else {
      media = `<iframe class="cctv-stream" src="${esc}" title="CCTV"></iframe>`;
    }

    $('cctvBox').innerHTML = `<div class="live">● LIVE</div>${media}`;
  }

  async function saveCameraUrl() {
    if (!selectedId) {
      toast('Select a tower first');
      return;
    }
    const streamUrl = $('cameraUrl').value.trim();
    try {
      await api(`/api/towers/${selectedId}/camera`, {
        method: 'PATCH',
        body: JSON.stringify({ streamUrl }),
      });
      toast(streamUrl ? 'Camera feed loaded' : 'Camera URL cleared');
      await loadTowers();
    } catch (e) {
      toast(e.message);
    }
  }

  function toast(msg) {
    const el = $('toast');
    el.textContent = msg;
    el.classList.remove('hidden');
    setTimeout(() => el.classList.add('hidden'), 3500);
  }

  function addHistory(text) {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    commandHistory.unshift({ time, text });
    if (commandHistory.length > 20) commandHistory.pop();
    $('commandHistory').innerHTML = commandHistory
      .map((h) => `<div class="history-row"><span>${h.time}</span><b>${h.text}</b></div>`)
      .join('');
  }

  async function api(path, options = {}) {
    const res = await fetch(`${CFG.API_URL}${path}`, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...options.headers },
      ...options,
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) {
      window.location.href = '/login.html';
      throw new Error('Login required');
    }
    if (!res.ok) throw new Error(data.error || res.statusText);
    return data;
  }

  async function ensureLoggedIn() {
    try {
      const me = await api('/api/auth/me');
      $('operatorBadge').textContent = `${me.username} · logged in`;
      return me;
    } catch {
      window.location.href = '/login.html';
      return null;
    }
  }

  async function sendCommand(action, payload, label) {
    if (!selectedId) {
      toast('Select a tower first');
      return;
    }
    try {
      const result = await api('/api/commands', {
        method: 'POST',
        body: JSON.stringify({ towerIds: [selectedId], action, payload }),
      });
      const ok = result.results?.every((r) => r.success);
      addHistory(`${label} — ${selectedId} — ${ok ? 'Success' : 'Failed'}`);
      toast(ok ? `${label} sent` : `${label} failed`);
      await loadTowers();
    } catch (e) {
      toast(e.message);
    }
  }

  async function loadTowers() {
    try {
      const data = await api('/api/towers');
      towers = data.map(normalizeTower);
      $('connBadge').textContent = towers.some((t) => t.online)
        ? 'Live — Pi connected'
        : 'Live — waiting for Pi';
      $('connBadge').className = 'badge conn-ok';
    } catch (e) {
      towers = [];
      $('connBadge').textContent = 'Server offline — start: cd server && npm start';
      $('connBadge').className = 'badge conn-warn';
    }
    if (!selectedId && towers.length) selectedId = towers[0].id;
    if (selectedId && !towers.find((t) => t.id === selectedId)) selectedId = towers[0]?.id || null;
    render();
  }

  function normalizeTower(t) {
    const bat = t.battery || {};
    const risk = computeRisk(t);
    return {
      id: t.id,
      name: t.name,
      zone: t.zone || t.name,
      online: t.online,
      battery: Math.round(bat.percent ?? 0),
      voltage: `${(bat.voltage ?? 0).toFixed(1)}V`,
      camera: t.camera?.online ?? false,
      streamUrl: (t.camera?.streamUrl || t.camera?.rtspUrl || '').trim(),
      beacon: t.devices?.beacon || t.devices?.beaconFlashing,
      speaker: t.devices?.speaker || '—',
      led: t.devices?.led || '—',
      lastSeen: formatLastSeen(t.lastSeen),
      lastSeenRaw: t.lastSeen,
      risk,
      gps: t.gps?.lat ? `${t.gps.lat}, ${t.gps.lng}` : '—',
      emergencyActive: t.emergencyActive,
      piHost: t.piHost || '—',
      router: t.routerConnected ? `Teltonika RUT — Connected` : 'Disconnected',
      signalRaw: t.signal || {},
      ...formatSignal(t.signal),
    };
  }

  function renderTowerList() {
    if (!towers.length) {
      $('towerList').innerHTML = `
        <div class="history-row muted" style="padding:1rem">
          No tower online yet.<br><br>
          1. Start server on PC: <code>cd server && npm start</code><br>
          2. On Pi (192.168.1.20): set API_URL to your PC IP in /etc/scs-agent.env<br>
          3. <code>sudo systemctl restart scs-agent</code>
        </div>`;
      return;
    }

    $('towerList').innerHTML = towers
      .map(
        (t) => `
      <button type="button" class="tower ${t.id === selectedId ? 'active' : ''}" data-id="${t.id}">
        <div class="tower-top">
          <div>
            <b>${t.id} — ${t.name}</b>
            <div class="muted">${t.zone} · Pi ${t.piHost}</div>
          </div>
          <div>${t.online ? '🟢' : '🔴'}</div>
        </div>
        <div class="tower-bottom">
          <span class="risk ${riskClass(t.risk)}">${t.risk}</span>
          <b>${t.battery}% · ${t.text !== '—' ? t.text : 'no signal'}</b>
        </div>
      </button>`
      )
      .join('');

    document.querySelectorAll('.tower').forEach((btn) => {
      btn.onclick = () => {
        selectedId = btn.dataset.id;
        render();
      };
    });
  }

  function renderSelectedTower() {
    const t = towers.find((x) => x.id === selectedId);
    if (!t) {
      $('towerTitle').textContent = 'No tower selected';
      $('towerSub').textContent = 'Connect your Raspberry Pi to see live data';
      $('riskBadge').textContent = '—';
      $('riskBadge').className = 'risk offline';
      $('sumTotal').textContent = '0';
      $('sumOnline').textContent = '0';
      $('sumAlerts').textContent = '0';
      $('sumEmergency').textContent = '0';
      return;
    }

    $('towerTitle').textContent = `${t.id} — ${t.name}`;
    $('towerSub').textContent = `Pi ${t.piHost} · Signal ${t.text} · Last seen ${t.lastSeen}`;
    $('riskBadge').textContent = t.risk;
    $('riskBadge').className = `risk ${riskClass(t.risk)}`;
    $('batteryText').textContent = `${t.battery}%`;
    $('voltageText').textContent = t.voltage;
    $('healthText').textContent = t.online ? 'OK' : 'Offline';
    $('signalText').textContent = t.text;
    $('signalSub').textContent = t.sub;
    renderSignalBars($('signalBars'), t.bars, t.rssi);
    $('speaker').textContent = t.speaker;
    $('led').textContent = t.led;
    $('beacon').textContent = t.beacon ? 'Flashing' : 'Off';
    const sig = t.signalRaw || {};
    $('router').textContent =
      sig.source === 'rut_api'
        ? `${t.router}${sig.rssi != null ? ` · ${sig.rssi} dBm` : ''}`
        : sig.source === 'pi_wifi'
          ? `Wi‑Fi · ${t.text}`
          : t.router;

    renderCctvBox(t);

    $('sumTotal').textContent = towers.length;
    $('sumOnline').textContent = towers.filter((x) => x.online).length;
    $('sumAlerts').textContent = towers.filter((x) => x.risk !== 'Normal' && x.risk !== 'Offline').length;
    $('sumEmergency').textContent = towers.filter((x) => x.risk === 'Evacuation').length;
  }

  function renderAnnouncements() {
    $('annGrid').innerHTML = CFG.ANNOUNCEMENTS.map(
      (a) =>
        `<button type="button" class="ann-btn" data-slot="${a.slot}">${a.slot}. ${a.label}</button>`
    ).join('');
    document.querySelectorAll('.ann-btn').forEach((btn) => {
      btn.onclick = () => {
        const slot = Number(btn.dataset.slot);
        const label = CFG.ANNOUNCEMENTS.find((x) => x.slot === slot)?.label;
        sendCommand('announcement', { slot, label }, `Announcement ${slot}`);
        $('announcePanel').classList.add('hidden');
      };
    });
  }

  function render() {
    renderTowerList();
    renderSelectedTower();
  }

  function bindControls() {
    $('btnEvac').onclick = () => {
      if (confirm('Trigger evacuation on selected tower?')) {
        sendCommand('evacuation', {}, 'Evacuation');
      }
    };
    $('btnGlobalEvac').onclick = () => {
      if (confirm('GLOBAL EVACUATION on all online towers?')) {
        api('/api/evacuation', { method: 'POST', body: '{}' })
          .then(() => {
            addHistory('Global evacuation');
            toast('Global evacuation sent');
            loadTowers();
          })
          .catch((e) => toast(e.message));
      }
    };
    $('btnBeacon').onclick = () => sendCommand('beacon_flash', { intervalMs: 500 }, 'Beacon flash');
    $('btnStop').onclick = () => sendCommand('stop_alerts', {}, 'Stop alerts');
    $('btnLed').onclick = () => {
      const text = $('ledMessage').value.trim();
      sendCommand('led_message', { text }, 'LED message');
    };
    $('btnReboot').onclick = () => {
      if (confirm('Reboot Raspberry Pi on selected tower?')) {
        sendCommand('reboot', {}, 'Remote reboot');
      }
    };
    $('btnAnnounce').onclick = () => {
      $('announcePanel').classList.toggle('hidden');
    };
    $('btnCameraSave').onclick = () => saveCameraUrl();
    $('btnCameraTest').onclick = () => {
      $('cameraUrl').value = CFG.DEFAULT_CAMERA_STREAM;
      saveCameraUrl();
    };
    $('cameraUrl').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') saveCameraUrl();
    });
    $('btnLogout').onclick = async () => {
      await fetch(`${CFG.API_URL}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
      window.location.href = '/login.html';
    };
  }

  async function start() {
    const me = await ensureLoggedIn();
    if (!me) return;
    renderAnnouncements();
    bindControls();
    loadTowers();
    setInterval(loadTowers, CFG.POLL_INTERVAL_MS);
  }

  start();
})();
