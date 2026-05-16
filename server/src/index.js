import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { createApiRouter } from './routes/api.js';
import { store } from './data/store.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDir = path.join(__dirname, '../../client');
const PORT = process.env.PORT || 3001;

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

app.use(
  '/api',
  createApiRouter({
    mqttUrl: process.env.MQTT_URL || 'mqtt://127.0.0.1:1883',
    mqttUser: process.env.MQTT_USER,
    mqttPassword: process.env.MQTT_PASSWORD,
  })
);

app.use(express.static(clientDir));

app.get('*', (_req, res) => {
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
});
