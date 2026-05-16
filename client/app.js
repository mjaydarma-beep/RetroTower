(function () {
  const CFG = window.SCS_CONFIG;
  let towers = [];
  let towersRaw = [];
  let rawViewTowerId = null;
  let selectedId = null;
  let commandHistory = [];
  let cctvHls = null;
  let mapCctvHls = null;
  let leafletMap = null;
  let mapMarkerLayer = null;
  let mapSelectedTowerId = null;
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

  function destroyMapCctvHls() {
    if (mapCctvHls) {
      mapCctvHls.destroy();
      mapCctvHls = null;
    }
  }

  function attachHlsPlayback(video, url, forMap) {
    if (forMap) {
      destroyMapCctvHls();
      if (window.Hls && window.Hls.isSupported()) {
        mapCctvHls = new window.Hls();
        mapCctvHls.loadSource(url);
        mapCctvHls.attachMedia(video);
        return;
      }
    } else {
      destroyCctvHls();
      if (window.Hls && window.Hls.isSupported()) {
        cctvHls = new window.Hls();
        cctvHls.loadSource(url);
        cctvHls.attachMedia(video);
        return;
      }
    }
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = url;
      return;
    }
    video.insertAdjacentHTML(
      'afterend',
      '<p class="muted" style="padding:8px">HLS not supported in this browser.</p>'
    );
  }

  function renderStreamInto(container, url, forMap) {
    if (!container) return;
    if (forMap) destroyMapCctvHls();
    else destroyCctvHls();

    if (!url) {
      container.innerHTML =
        '<div class="cctv-placeholder"><b>No camera</b><br><span class="muted">Set stream URL in dashboard</span></div>';
      return;
    }

    const kind = streamKind(url);
    const esc = url.replace(/"/g, '&quot;');
    const videoId = forMap ? 'mapCctvVideo' : 'cctvVideo';

    if (kind === 'rtsp') {
      container.innerHTML =
        '<div class="cctv-placeholder"><b>RTSP</b><br><span class="muted">Use go2rtc HTTP URL</span></div>';
      return;
    }
    if (kind === 'embed') {
      container.innerHTML = `<div class="live">LIVE</div><iframe class="cctv-stream" src="${esc}" title="CCTV" allow="autoplay"></iframe>`;
      return;
    }
    if (kind === 'mjpeg' || kind === 'http') {
      container.innerHTML = `<div class="live">LIVE</div><img class="cctv-stream" src="${esc}" alt="CCTV" />`;
      return;
    }
    if (kind === 'hls') {
      container.innerHTML = `<div class="live">LIVE</div><video id="${videoId}" class="cctv-stream" autoplay muted playsinline controls></video>`;
      const video = document.getElementById(videoId);
      if (video) attachHlsPlayback(video, url, forMap);
      return;
    }
    if (kind === 'video') {
      container.innerHTML = `<div class="live">LIVE</div><video class="cctv-stream" src="${esc}" autoplay muted playsinline controls></video>`;
      return;
    }
    container.innerHTML = `<div class="live">LIVE</div><iframe class="cctv-stream" src="${esc}" title="CCTV"></iframe>`;
  }

  function renderCctvBox(t) {
    const url = t.streamUrl || CFG.DEFAULT_CAMERA_STREAM || '';
    const input = $('cameraUrl');
    if (input && document.activeElement !== input) input.value = url;
    renderStreamInto($('cctvBox'), url, false);
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

  function getTowerRawJsonText() {
    if (!rawViewTowerId) return '';
    const t = towersRaw.find((x) => x.id === rawViewTowerId);
    return JSON.stringify(t || { error: 'Tower not found', id: rawViewTowerId }, null, 2);
  }

  function updateTowerRawPanel() {
    const panel = $('towerRawPanel');
    if (!panel || panel.classList.contains('hidden')) return;
    $('towerRawTitle').textContent = rawViewTowerId
      ? `${rawViewTowerId} — tower raw JSON`
      : 'Tower raw JSON';
    $('towerRawData').textContent = getTowerRawJsonText() || '—';
  }

  function showTowerRaw(towerId) {
    rawViewTowerId = towerId;
    $('towerRawPanel')?.classList.remove('hidden');
    updateTowerRawPanel();
  }

  function closeTowerRaw() {
    rawViewTowerId = null;
    $('towerRawPanel')?.classList.add('hidden');
  }

  async function loadTowers() {
    try {
      const data = await api('/api/towers');
      towersRaw = data;
      towers = data.map(normalizeTower);
      $('connBadge').textContent = towers.some((t) => t.online)
        ? 'Connected'
        : 'Waiting for Pi';
      $('connBadge').className = 'chip';
    } catch (e) {
      towers = [];
      $('connBadge').textContent = 'Server offline';
      $('connBadge').className = 'chip conn-warn';
    }
    if (!selectedId && towers.length) selectedId = towers[0].id;
    if (selectedId && !towers.find((t) => t.id === selectedId)) selectedId = towers[0]?.id || null;
    if (rawViewTowerId) updateTowerRawPanel();
    render();
  }

  function towerCoords(t) {
    const lat = t.lat ?? t.gps?.lat;
    const lng = t.lng ?? t.gps?.lng;
    if (lat == null || lng == null) return null;
    const la = Number(lat);
    const ln = Number(lng);
    if (!Number.isFinite(la) || !Number.isFinite(ln)) return null;
    if (la === 0 && ln === 0) return null;
    return { lat: la, lng: ln };
  }

  function normalizeTower(t) {
    const bat = t.battery || {};
    const risk = computeRisk(t);
    const coords = towerCoords(t);
    return {
      id: t.id,
      name: t.name,
      zone: t.zone || t.name,
      lat: coords?.lat,
      lng: coords?.lng,
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
      gps: coords ? `${coords.lat}, ${coords.lng}` : '—',
      emergencyActive: t.emergencyActive,
      piHost: t.piHost || '—',
      router: t.routerConnected ? `Teltonika RUT — Connected` : 'Disconnected',
      signalRaw: t.signal || {},
      ...formatSignal(t.signal),
    };
  }

  function esc(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/"/g, '&quot;');
  }

  function renderTowerTable() {
    const body = $('towerTableBody');
    if (!body) return;

    if (!towers.length) {
      body.innerHTML = `
        <tr><td colspan="15" class="muted" style="padding:1rem;white-space:normal">
          No tower online yet.<br><br>
          1. Start server on PC: <code>cd server && npm start</code><br>
          2. On Pi: set API_URL in /etc/scs-agent.env<br>
          3. <code>sudo systemctl restart scs-agent</code>
        </td></tr>`;
      return;
    }

    body.innerHTML = towers
      .map(
        (t) => `
      <tr class="${t.id === selectedId ? 'active' : ''}" data-id="${esc(t.id)}">
        <td class="cell-id">${esc(t.id)}</td>
        <td>${esc(t.name)}</td>
        <td>${esc(t.zone)}</td>
        <td><span class="status-dot ${t.online ? 'on' : 'off'}"></span>${t.online ? 'Online' : 'Offline'}</td>
        <td><span class="risk-pill risk ${riskClass(t.risk)}">${esc(t.risk)}</span></td>
        <td><b>${t.battery}%</b></td>
        <td>${esc(t.voltage)}</td>
        <td>${esc(t.text)}</td>
        <td>${esc(t.gps)}</td>
        <td>${esc(t.piHost)}</td>
        <td>${t.beacon ? 'On' : 'Off'}</td>
        <td>${esc(t.led)}</td>
        <td>${t.camera ? 'On' : 'Off'}</td>
        <td>${esc(t.lastSeen)}</td>
        <td class="cell-actions"><button type="button" class="btn btn-ghost btn-row-raw" data-id="${esc(t.id)}">Raw</button></td>
      </tr>`
      )
      .join('');

    if (!body.dataset.rawBound) {
      body.dataset.rawBound = '1';
      body.addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-row-raw');
        if (btn) {
          e.stopPropagation();
          showTowerRaw(btn.dataset.id);
          return;
        }
        const row = e.target.closest('tr[data-id]');
        if (row) {
          selectedId = row.dataset.id;
          render();
        }
      });
    }
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
    $('towerSub').textContent = `Pi ${t.piHost} · GPS ${t.gps} · Signal ${t.text} · Last seen ${t.lastSeen}`;
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


  function isMapOpen() {
    return $('mapModal') && !$('mapModal').classList.contains('hidden');
  }

  function initLeafletMap() {
    if (leafletMap || !window.L) return;
    const el = $('mapModalMap');
    if (!el) return;
    leafletMap = window.L.map(el, { scrollWheelZoom: true }).setView([-32.057, 115.752], 13);
    window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19,
    }).addTo(leafletMap);
    mapMarkerLayer = window.L.layerGroup().addTo(leafletMap);
  }

  function mapMarkerHtml(online) {
    const cls = online ? 'on' : 'off';
    return `<div class="tower-map-marker"><div class="pin ${cls}"></div></div>`;
  }

  function selectMapTower(t) {
    mapSelectedTowerId = t.id;
    $('mapPanelEmpty').classList.add('hidden');
    $('mapPanelDetail').classList.remove('hidden');
    $('mapTowerTitle').textContent = `${t.id} — ${t.name}`;
    $('mapTowerRisk').textContent = t.risk;
    $('mapTowerRisk').className = `risk ${riskClass(t.risk)}`;
    $('mapTowerMeta').innerHTML = [
      `<div><b>Status</b> ${t.online ? 'Live' : 'Offline'}</div>`,
      `<div><b>Site</b> ${esc(t.zone)}</div>`,
      `<div><b>Battery</b> ${t.battery}% · ${esc(t.voltage)}</div>`,
      `<div><b>Signal</b> ${esc(t.text)}</div>`,
      `<div><b>GPS</b> ${esc(t.gps)}</div>`,
      `<div><b>Pi</b> ${esc(t.piHost)} · ${esc(t.lastSeen)}</div>`,
      `<div><b>Beacon</b> ${t.beacon ? 'On' : 'Off'} · <b>LED</b> ${esc(t.led)}</div>`,
    ].join('');
    const url = t.streamUrl || CFG.DEFAULT_CAMERA_STREAM || '';
    renderStreamInto($('mapCctvBox'), url, true);
  }

  function clearMapTowerPanel() {
    mapSelectedTowerId = null;
    $('mapPanelEmpty').classList.remove('hidden');
    $('mapPanelDetail').classList.add('hidden');
    destroyMapCctvHls();
    if ($('mapCctvBox')) $('mapCctvBox').innerHTML = '';
  }

  function updateMapMarkers() {
    if (!leafletMap || !mapMarkerLayer) return;
    mapMarkerLayer.clearLayers();
    const plotted = towers.filter((t) => t.lat != null && t.lng != null);
    const noGps = towers.length - plotted.length;
    const hint = $('mapPlotHint');
    if (hint) {
      hint.textContent = plotted.length
        ? `${plotted.length} plotted` + (noGps ? ` · ${noGps} no GPS` : '')
        : noGps ? `${noGps} tower(s) need TOWER_LAT/LNG` : '';
    }
    if (!plotted.length) {
      clearMapTowerPanel();
      return;
    }
    const bounds = [];
    for (const t of plotted) {
      const icon = window.L.divIcon({
        className: 'tower-map-marker',
        html: mapMarkerHtml(t.online),
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });
      const marker = window.L.marker([t.lat, t.lng], { icon });
      marker.bindPopup(
        `<b>${esc(t.id)}</b><br>${esc(t.name)}<br>${t.online ? 'Live' : 'Offline'} · ${t.battery}%`
      );
      marker.on('click', () => selectMapTower(t));
      mapMarkerLayer.addLayer(marker);
      bounds.push([t.lat, t.lng]);
    }
    if (bounds.length === 1) leafletMap.setView(bounds[0], 14);
    else leafletMap.fitBounds(bounds, { padding: [48, 48], maxZoom: 15 });
    if (mapSelectedTowerId) {
      const sel = plotted.find((x) => x.id === mapSelectedTowerId);
      if (sel) selectMapTower(sel);
      else clearMapTowerPanel();
    }
  }

  function openMapView() {
    if (!window.L) {
      toast('Map library not loaded');
      return;
    }
    const plotted = towers.filter((t) => t.lat != null && t.lng != null);
    if (!plotted.length) {
      toast('No tower GPS — set TOWER_LAT and TOWER_LNG on Pi');
    }
    $('mapModal').classList.remove('hidden');
    $('mapModal').setAttribute('aria-hidden', 'false');
    initLeafletMap();
    updateMapMarkers();
    setTimeout(() => leafletMap && leafletMap.invalidateSize(), 150);
  }

  function closeMapView() {
    $('mapModal').classList.add('hidden');
    $('mapModal').setAttribute('aria-hidden', 'true');
    clearMapTowerPanel();
  }

  function render() {
    renderTowerTable();
    renderSelectedTower();
    if (isMapOpen()) updateMapMarkers();
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
    $('btnMapView').onclick = () => openMapView();
    $('btnMapClose').onclick = () => closeMapView();
    $('btnMapOpenTower').onclick = () => {
      if (!mapSelectedTowerId) return;
      selectedId = mapSelectedTowerId;
      closeMapView();
      render();
    };
    $('btnLogout').onclick = async () => {
      await fetch(`${CFG.API_URL}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
      window.location.href = '/login.html';
    };
    $('btnTowerRawClose').onclick = () => closeTowerRaw();
    $('btnTowerRawCopy').onclick = async () => {
      const text = getTowerRawJsonText();
      if (!text) return;
      try {
        await navigator.clipboard.writeText(text);
        $('btnTowerRawCopy').textContent = 'Copied';
        setTimeout(() => {
          $('btnTowerRawCopy').textContent = 'Copy';
        }, 1500);
      } catch {
        toast('Copy failed');
      }
    };
  }

  async function loadIntegrations() {
    try {
      const data = await api('/api/integrations');
      if (data.announcements?.length) {
        CFG.ANNOUNCEMENTS = data.announcements;
      }
    } catch {
      /* use client/config.js defaults */
    }
  }

  async function start() {
    const me = await ensureLoggedIn();
    if (!me) return;
    await loadIntegrations();
    renderAnnouncements();
    bindControls();
    loadTowers();
    setInterval(loadTowers, CFG.POLL_INTERVAL_MS);
  }

  start();
})();
