import mqtt from 'mqtt';
import { v4 as uuid } from 'uuid';

let client = null;

export function initMqtt(config) {
  const url = config.mqttUrl || 'mqtt://127.0.0.1:1883';
  client = mqtt.connect(url, {
    username: config.mqttUser,
    password: config.mqttPassword,
  });

  client.on('connect', () => console.log('[mqtt] connected', url));
  client.on('error', (err) => console.error('[mqtt]', err.message));

  return client;
}

export function publishCommand(towerId, action, payload = {}) {
  if (!client?.connected) {
    console.warn('[mqtt] not connected — command not sent');
    return false;
  }
  const topic = `scs/towers/${towerId}/cmd/${action}`;
  client.publish(topic, JSON.stringify(payload), { qos: 1 });
  return true;
}

export function mqttTopicForLed(towerId) {
  return `scs/towers/${towerId}/led/display`;
}

export function getMqttStatus() {
  const url = process.env.MQTT_URL || 'mqtt://127.0.0.1:1883';
  return {
    url,
    connected: Boolean(client?.connected),
    reconnecting: Boolean(client?.reconnecting),
  };
}
