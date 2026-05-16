import { v4 as uuid } from 'uuid';
import { getIntegrations } from '../config/integrations.js';
import { store } from '../data/store.js';
import { enqueueCommand } from './deviceRegistry.js';
import { publishCommand } from './mqttBridge.js';
import { triggerSipAnnouncement } from './sipBridge.js';

export async function executeCommand({ towerIds, action, payload = {}, username = 'operator' }) {
  const results = [];
  const integ = getIntegrations();

  for (const towerId of towerIds) {
    const tower = store.getTower(towerId);
    if (!tower) {
      results.push({ towerId, success: false, error: 'Tower not found' });
      continue;
    }

    const cmd = { id: uuid(), action, payload };
    enqueueCommand(towerId, cmd);
    const mqttSent = publishCommand(towerId, action, payload);

    let sipSent = false;
    let sipVia = null;
    if (action === 'announcement') {
      const sipResult = await triggerSipAnnouncement({
        towerId,
        slot: payload.slot,
        label: payload.label,
        payload,
      });
      sipSent = sipResult.sent;
      sipVia = sipResult.via;
    } else if (action === 'evacuation' && integ.sip.enabled) {
      const sipResult = await triggerSipAnnouncement({
        towerId,
        slot: integ.sip.evacSlot,
        label: 'Evacuation',
        payload: { ...payload, evacuation: true },
      });
      sipSent = sipResult.sent;
      sipVia = sipResult.via;
    }

    const httpOk = integ.commands.httpFallback && tower.online;
    const success = mqttSent || sipSent || httpOk;
    if (!mqttSent && httpOk) {
      console.log(`[command] queued for HTTP delivery: ${towerId} ${action}`);
    }

    applyLocalState(tower, action, payload);

    const via = [mqttSent && 'mqtt', sipSent && `sip:${sipVia}`, httpOk && !mqttSent && 'http']
      .filter(Boolean)
      .join('+') || 'none';

    const result = { towerId, success, towerName: tower.name, via, sipSent };
    results.push(result);

    store.addCommand({
      username,
      towerId,
      towerName: tower.name,
      action,
      payload,
      success: result.success,
      via,
    });
  }

  return { success: results.every((r) => r.success), results };
}

function applyLocalState(tower, action, payload) {
  if (!tower.online && action !== 'reboot') return;

  switch (action) {
    case 'evacuation':
      tower.emergencyActive = true;
      tower.devices.beacon = true;
      tower.devices.beaconFlashing = true;
      tower.devices.led = 'EVACUATE BEACH NOW';
      tower.devices.speaker = 'playing';
      break;
    case 'led_message':
      tower.devices.led = payload.text || '';
      break;
    case 'beacon_on':
      tower.devices.beacon = true;
      tower.devices.beaconFlashing = false;
      break;
    case 'beacon_flash':
      tower.devices.beacon = true;
      tower.devices.beaconFlashing = true;
      break;
    case 'beacon_off':
      tower.devices.beacon = false;
      tower.devices.beaconFlashing = false;
      break;
    case 'stop_alerts':
      tower.emergencyActive = false;
      tower.devices.beacon = false;
      tower.devices.beaconFlashing = false;
      tower.devices.led = 'Ready';
      tower.devices.speaker = 'Ready';
      break;
    case 'announcement':
      tower.devices.speaker = 'playing';
      setTimeout(() => {
        if (!tower.emergencyActive) tower.devices.speaker = 'Ready';
      }, 8000);
      break;
    case 'reboot':
      tower.online = false;
      setTimeout(() => {
        tower.online = true;
        tower.lastSeen = new Date().toISOString();
      }, 8000);
      break;
    default:
      break;
  }
}
