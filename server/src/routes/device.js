import { Router } from 'express';
import { store } from '../data/store.js';
import { dequeueCommands, registerHeartbeat } from '../services/deviceRegistry.js';

export const deviceRouter = Router();

const DEFAULT_TOWER_ID = process.env.TOWER_ID || 'TWR-001';
const DEFAULT_DEVICE_KEY = process.env.PI_DEVICE_KEY || 'pi4-twr-001-key';

function buildDeviceKeys() {
  const keys = {
    [DEFAULT_TOWER_ID]: DEFAULT_DEVICE_KEY,
    'tower-001': DEFAULT_DEVICE_KEY,
    'TWR-SIM-001': DEFAULT_DEVICE_KEY,
    'TWR-SIM-002': process.env.SIM_TWR_002_KEY || 'pi4-sim-002-key',
  };
  const extra = process.env.PI_DEVICE_KEYS || '';
  for (const part of extra.split(',')) {
    const piece = part.trim();
    if (!piece || !piece.includes(':')) continue;
    const colon = piece.indexOf(':');
    const id = piece.slice(0, colon).trim();
    const key = piece.slice(colon + 1).trim();
    if (id && key) keys[id] = key;
  }
  return keys;
}

const KEYS = buildDeviceKeys();

deviceRouter.use((req, res, next) => {
  const towerId = req.headers['x-tower-id'];
  const key = req.headers['x-device-key'];
  if (!towerId || !key || KEYS[towerId] !== key) {
    return res.status(401).json({ error: 'Invalid device credentials' });
  }
  req.towerId = towerId;
  req.tower = store.ensureTower(towerId);
  next();
});

deviceRouter.post('/telemetry', (req, res) => {
  const t = req.tower;
  const body = req.body;

  registerHeartbeat(t.id);
  t.online = true;
  t.lastSeen = new Date().toISOString();
  t.routerConnected = body.routerConnected ?? body.signal?.connected ?? true;
  t.deviceHealth = body.deviceHealth || 'healthy';

  if (body.battery) Object.assign(t.battery, body.battery);
  if (body.camera) {
    const { streamUrl: _ignore, ...fromPi } = body.camera;
    Object.assign(t.camera, fromPi);
  }
  if (body.devices) Object.assign(t.devices, body.devices);
  if (body.emergencyActive != null) t.emergencyActive = body.emergencyActive;
  if (body.signal) t.signal = { ...t.signal, ...body.signal };
  if (body.hostname) t.iotDevice = { ...t.iotDevice, hostname: body.hostname };
  if (body.piHost) t.piHost = body.piHost;
  if (body.towerName) t.name = body.towerName;

  const loc = body.location || body.gps;
  if (loc?.lat != null && loc?.lng != null) {
    const lat = Number(loc.lat);
    const lng = Number(loc.lng);
    if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
      t.lat = lat;
      t.lng = lng;
      t.gps = { lat, lng: lng };
      if (body.location?.label) t.zone = body.location.label;
    }
  }

  res.json({ ok: true, pendingCommands: dequeueCommands(t.id) });
});

deviceRouter.post('/commands/:id/ack', (req, res) => {
  res.json({ ok: true });
});
