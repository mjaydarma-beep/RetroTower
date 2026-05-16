import { v4 as uuid } from 'uuid';
import { store } from '../data/store.js';
import { enqueueCommand } from './deviceRegistry.js';
import { publishCommand } from './mqttBridge.js';

export async function executeCommand({ towerIds, action, payload = {}, username = 'operator' }) {
  const results = [];

  for (const towerId of towerIds) {
    const tower = store.getTower(towerId);
    if (!tower) {
      results.push({ towerId, success: false, error: 'Tower not found' });
      continue;
    }

    const cmd = { id: uuid(), action, payload };
    enqueueCommand(towerId, cmd);
    const mqttSent = publishCommand(towerId, action, payload);
    // Pi without MQTT receives commands on next telemetry POST (~15s)
    const success = mqttSent || tower.online;
    if (!mqttSent && tower.online) {
      console.log(`[command] queued for HTTP delivery: ${towerId} ${action}`);
    }
    applyLocalState(tower, action, payload);

    const result = { towerId, success, towerName: tower.name, via: mqttSent ? 'mqtt' : 'http' };
    results.push(result);

    store.addCommand({
      username,
      towerId,
      towerName: tower.name,
      action,
      payload,
      success: result.success,
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
