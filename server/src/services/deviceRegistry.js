const agents = new Map();
const queues = new Map();

export function registerHeartbeat(towerId) {
  agents.set(towerId, { lastSeen: Date.now() });
}

export function enqueueCommand(towerId, cmd) {
  if (!queues.has(towerId)) queues.set(towerId, []);
  queues.get(towerId).push(cmd);
}

export function dequeueCommands(towerId) {
  const q = queues.get(towerId) || [];
  queues.set(towerId, []);
  return q;
}

export function getRegistrySnapshot() {
  const agentSnap = {};
  for (const [towerId, data] of agents) {
    agentSnap[towerId] = {
      lastSeenMs: data.lastSeen,
      lastSeen: new Date(data.lastSeen).toISOString(),
      ageSec: Math.round((Date.now() - data.lastSeen) / 1000),
    };
  }
  const pendingCommands = {};
  for (const [towerId, list] of queues) {
    pendingCommands[towerId] = list.map((c) => ({
      id: c.id,
      action: c.action,
      payload: c.payload,
    }));
  }
  return { agents: agentSnap, pendingCommands };
}
