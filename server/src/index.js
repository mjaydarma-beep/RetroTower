import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { createApiRouter } from './routes/api.js';
import { store } from './data/store.js';
import { getIntegrations, getIntegrationsPublic } from './config/integrations.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDir = path.join(__dirname, '../../client');
const PORT = process.env.PORT || 3001;

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

const integ = getIntegrations();
const apiRouter = createApiRouter({
  mqttUrl: integ.mqtt.url,
  mqttUser: integ.mqtt.user,
  mqttPassword: integ.mqtt.password,
});

app.use('/api', apiRouter);

app.use(express.static(clientDir));

app.get('*', (req, res) => {
  const url = req.originalUrl || req.url || '';
  if (url.startsWith('/api/')) {
    return res.status(404).json({ error: 'API route not found', path: url });
  }
  res.sendFile(path.join(clientDir, 'index.html'));
});

setInterval(() => store.markStaleOffline(), 15_000);

app.listen(PORT, '0.0.0.0', () => {
  const t = store.towers[0];
  console.log(`SCS Control Center: http://localhost:${PORT}`);
  console.log(`Tower registered: ${t?.id} — ${t?.name} (Pi ${t?.piHost})`);
  console.log(`Waiting for Pi telemetry on /api/device/telemetry`);
  console.log(`Operator login: http://localhost:${PORT}/login.html`);
  console.log(`Server debug:    http://localhost:${PORT}/debug.html`);
  const pub = getIntegrationsPublic();
  console.log(
    `[integrations] MQTT ${pub.mqtt.enabled ? pub.mqtt.url : 'off'} · SIP ${pub.sip.enabled ? pub.sip.mode : 'off'}`
  );
});
