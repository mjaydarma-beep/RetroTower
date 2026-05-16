import { v4 as uuid } from 'uuid';

/** Public HLS test stream (Mux) — replace with real camera URL in production */
export const TEST_CAMERA_STREAM =
  process.env.TEST_CAMERA_STREAM ||
  'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8';

/** Single real tower — your Raspberry Pi at 192.168.1.20 */
function createRealTower() {
  return {
    id: process.env.TOWER_ID || 'TWR-001',
    name: process.env.TOWER_NAME || 'Manjul Raspberry Pi Tower',
    zone: process.env.TOWER_ZONE || 'Remote Site',
    piHost: process.env.PI_HOST || '192.168.1.20',
    piUser: process.env.PI_USER || 'manjul',
    lat: 0,
    lng: 0,
    online: false,
    routerConnected: false,
    deviceHealth: 'offline',
    emergencyActive: false,
    battery: { percent: 0, voltage: 0, charging: false, current: 0, health: 'unknown' },
    camera: { online: true, rtspUrl: '', streamUrl: TEST_CAMERA_STREAM },
    devices: { speaker: '—', led: '—', beacon: false, beaconFlashing: false },
    gps: { lat: 0, lng: 0 },
    iotDevice: { type: 'Raspberry Pi 4', hostname: '' },
    lastSeen: null,
    signal: { rssi: null, connected: false },
  };
}

const towers = [createRealTower()];

const OFFLINE_AFTER_MS = Number(process.env.TOWER_OFFLINE_MS || 90_000);

export const store = {
  towers,
  commandHistory: [],

  getTower(id) {
    return this.towers.find((t) => t.id === id);
  },

  ensureTower(id, patch = {}) {
    let t = this.getTower(id);
    if (!t) {
      t = { ...createRealTower(), id, ...patch };
      this.towers.push(t);
    }
    return t;
  },

  markStaleOffline() {
    const now = Date.now();
    for (const t of this.towers) {
      if (!t.lastSeen) {
        t.online = false;
        t.deviceHealth = 'offline';
        continue;
      }
      const age = now - new Date(t.lastSeen).getTime();
      if (age > OFFLINE_AFTER_MS) {
        t.online = false;
        t.deviceHealth = 'offline';
        t.routerConnected = false;
      }
    }
  },

  addCommand(entry) {
    const row = { id: uuid(), timestamp: new Date().toISOString(), ...entry };
    this.commandHistory.unshift(row);
    if (this.commandHistory.length > 200) this.commandHistory.pop();
    return row;
  },
};
