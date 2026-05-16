import mqtt from 'mqtt';
import { getIntegrations } from '../config/integrations.js';

let client = null;
let mqttConfig = null;

export function initMqtt(config) {
  mqttConfig = config;
  const integ = getIntegrations().mqtt;
  if (!integ.enabled) {
    console.log('[mqtt] disabled (MQTT_ENABLED=false)');
    return null;
  }

  const url = config?.mqttUrl || integ.url;
  client = mqtt.connect(url, {
    username: config?.mqttUser || integ.user || undefined,
    password: config?.mqttPassword || integ.password || undefined,
  });

  client.on('connect', () => console.log('[mqtt] connected', url));
  client.on('error', (err) => console.error('[mqtt]', err.message));

  return client;
}

export function publishCommand(towerId, action, payload = {}) {
  const integ = getIntegrations().mqtt;
  if (!integ.enabled) return false;
  if (!client?.connected) {
    console.warn('[mqtt] not connected — command not sent');
    return false;
  }
  const topic = integ.commandTopic(towerId, action);
  client.publish(topic, JSON.stringify(payload), { qos: integ.qos });
  return true;
}

/** Publish to any topic (e.g. SIP gateway on MQTT) */
export function publishRaw(topic, payload, opts = {}) {
  const integ = getIntegrations().mqtt;
  if (!integ.enabled || !client?.connected) return false;
  const body = typeof payload === 'string' ? payload : JSON.stringify(payload);
  client.publish(topic, body, { qos: opts.qos ?? integ.qos });
  return true;
}

export function mqttTopicForLed(towerId) {
  return getIntegrations().mqtt.ledTopic(towerId);
}

export function getMqttStatus() {
  const integ = getIntegrations().mqtt;
  return {
    enabled: integ.enabled,
    url: mqttConfig?.mqttUrl || integ.url,
    topicPrefix: integ.topicPrefix,
    connected: Boolean(client?.connected),
    reconnecting: Boolean(client?.reconnecting),
  };
}
