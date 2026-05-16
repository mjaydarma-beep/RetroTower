import { Router } from 'express';
import { store } from '../data/store.js';
import { executeCommand } from '../services/commandService.js';
import { initMqtt } from '../services/mqttBridge.js';
import { getIntegrationsPublic } from '../config/integrations.js';
import { getMqttStatus } from '../services/mqttBridge.js';
import { getSipStatus } from '../services/sipBridge.js';
import { requireOperator } from '../middleware/operatorAuth.js';
import { authRouter } from './auth.js';
import { debugRouter } from './debug.js';
import { deviceRouter } from './device.js';

const router = Router();

router.use('/auth', authRouter);
router.use('/device', deviceRouter);
/** Debug metrics — no login required (local network only) */
router.use('/debug', debugRouter);
router.use(requireOperator);

router.get('/towers', (_req, res) => {
  res.json(store.towers);
});

router.patch('/towers/:id/camera', (req, res) => {
  const tower = store.getTower(req.params.id);
  if (!tower) return res.status(404).json({ error: 'Tower not found' });
  const streamUrl = String(req.body.streamUrl ?? '').trim();
  tower.camera.streamUrl = streamUrl;
  if (streamUrl.toLowerCase().startsWith('rtsp://')) {
    tower.camera.rtspUrl = streamUrl;
  }
  tower.camera.online = Boolean(streamUrl);
  res.json({ ok: true, camera: tower.camera });
});

router.get('/commands/history', (_req, res) => {
  res.json(store.commandHistory);
});

/** Central integration settings (MQTT / SIP) — change via server/.env */
router.get('/integrations', (_req, res) => {
  res.json({
    ...getIntegrationsPublic(),
    status: {
      mqtt: getMqttStatus(),
      sip: getSipStatus(),
    },
  });
});

router.post('/commands', async (req, res) => {
  const { towerIds, action, payload } = req.body;
  if (!towerIds?.length || !action) {
    return res.status(400).json({ error: 'towerIds and action required' });
  }
  const result = await executeCommand({
    towerIds,
    action,
    payload,
    username: req.operator,
  });
  res.json(result);
});

router.post('/evacuation', async (req, res) => {
  const towerIds = req.body.towerIds?.length
    ? req.body.towerIds
    : store.towers.filter((t) => t.online).map((t) => t.id);
  const result = await executeCommand({
    towerIds,
    action: 'evacuation',
    payload: {},
    username: req.operator,
  });
  res.json(result);
});

export function createApiRouter(mqttConfig) {
  if (mqttConfig) initMqtt(mqttConfig);
  return router;
}
