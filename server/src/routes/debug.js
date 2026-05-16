import { Router } from 'express';
import { store } from '../data/store.js';
import { getRegistrySnapshot } from '../services/deviceRegistry.js';
import { getMqttStatus } from '../services/mqttBridge.js';

export const debugRouter = Router();

const startedAt = Date.now();

debugRouter.get('/status', (_req, res) => {
  const registry = getRegistrySnapshot();
  const mqtt = getMqttStatus();
  const now = Date.now();

  const towers = store.towers.map((t) => {
    const agent = registry.agents[t.id];
    const pending = registry.pendingCommands[t.id] || [];
    const lastSeenAge = t.lastSeen
      ? Math.round((now - new Date(t.lastSeen).getTime()) / 1000)
      : null;

    return {
      ...t,
      connections: {
        telemetry: {
          ok: t.online,
          lastSeen: t.lastSeen,
          ageSec: lastSeenAge,
          piHost: t.piHost,
        },
        agentHeartbeat: agent || null,
        mqtt: {
          ok: mqtt.connected,
          note: mqtt.connected
            ? 'Broker connected (commands via MQTT)'
            : 'MQTT offline — commands use HTTP queue',
        },
        httpCommandQueue: {
          pending: pending.length,
          commands: pending,
        },
      },
    };
  });

  res.json({
    timestamp: new Date().toISOString(),
    server: {
      uptimeSec: Math.round((now - startedAt) / 1000),
      port: process.env.PORT || 3001,
      towerCount: store.towers.length,
      onlineCount: store.towers.filter((t) => t.online).length,
    },
    connections: {
      mqtt,
      piAgents: registry.agents,
      httpQueues: Object.fromEntries(
        Object.entries(registry.pendingCommands).map(([id, list]) => [id, list.length])
      ),
    },
    towers,
    recentCommands: store.commandHistory.slice(0, 25),
  });
});
