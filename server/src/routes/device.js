import { Router } from 'express';
import { store } from '../data/store.js';
import { dequeueCommands, registerHeartbeat } from '../services/deviceRegistry.js';

export const deviceRouter = Router();

const DEFAULT_TOWER_ID = process.env.TOWER_ID || 'TWR-001';
const DEFAULT_DEVICE_KEY = process.env.PI_DEVICE_KEY || 'pi4-twr-001-key';

/** tower-001 is legacy default from early agent builds */
const KEYS = {
  [DEFAULT_TOWER_ID]: DEFAULT_DEVICE_KEY,
  'tower-001': DEFAULT_DEVICE_KEY,
};

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

  res.json({ ok: true, pendingCommands: dequeueCommands(t.id) });
});

deviceRouter.post('/commands/:id/ack', (req, res) => {
  res.json({ ok: true });
});
