/**
 * Central integration settings — change MQTT / SIP in server/.env only.
 * Restart server after edits: cd server && npm start
 */

function env(key, fallback = '') {
  const v = process.env[key];
  return v !== undefined && v !== '' ? String(v).trim() : fallback;
}

function envBool(key, fallback = false) {
  const v = env(key, fallback ? 'true' : 'false').toLowerCase();
  return ['1', 'true', 'yes', 'on'].includes(v);
}

function envInt(key, fallback) {
  const n = parseInt(env(key, String(fallback)), 10);
  return Number.isNaN(n) ? fallback : n;
}

/** Default announcement slots (overridden by ANNOUNCEMENT_SLOTS_JSON) */
const DEFAULT_ANNOUNCEMENTS = [
  { slot: 1, label: 'All clear', sipRef: '1' },
  { slot: 2, label: 'Evacuate beach', sipRef: '2' },
  { slot: 3, label: 'Test tone', sipRef: '3' },
  { slot: 4, label: 'Lockdown', sipRef: '4' },
  { slot: 5, label: 'Maintenance', sipRef: '5' },
  { slot: 6, label: 'Weather alert', sipRef: '6' },
  { slot: 7, label: 'Intruder alert', sipRef: '7' },
  { slot: 8, label: 'Fire drill', sipRef: '8' },
  { slot: 9, label: 'Stand by', sipRef: '9' },
  { slot: 10, label: 'Custom message', sipRef: '10' },
];

function parseAnnouncementSlots() {
  const raw = env('ANNOUNCEMENT_SLOTS_JSON');
  if (!raw) return DEFAULT_ANNOUNCEMENTS;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    console.warn('[config] ANNOUNCEMENT_SLOTS_JSON invalid — using defaults');
  }
  return DEFAULT_ANNOUNCEMENTS;
}

let cached = null;

export function getIntegrations() {
  if (cached) return cached;

  const mqttPrefix = env('MQTT_TOPIC_PREFIX', 'scs/towers').replace(/\/$/, '');

  cached = {
    mqtt: {
      enabled: envBool('MQTT_ENABLED', true),
      url: env('MQTT_URL', 'mqtt://127.0.0.1:1883'),
      user: env('MQTT_USER'),
      password: env('MQTT_PASSWORD'),
      topicPrefix: mqttPrefix,
      qos: envInt('MQTT_QOS', 1),
      commandTopic(towerId, action) {
        return `${mqttPrefix}/${towerId}/cmd/${action}`;
      },
      ledTopic(towerId) {
        return `${mqttPrefix}/${towerId}/led/display`;
      },
    },
    sip: {
      enabled: envBool('SIP_ENABLED', false),
      /** http | mqtt | both */
      mode: env('SIP_MODE', 'http').toLowerCase(),
      httpUrl: env('SIP_HTTP_URL'),
      httpMethod: env('SIP_HTTP_METHOD', 'POST').toUpperCase(),
      httpToken: env('SIP_HTTP_TOKEN'),
      httpBearer: env('SIP_HTTP_BEARER'),
      mqttTopic: env('SIP_MQTT_TOPIC', 'scs/sip/announce'),
      defaultExtension: env('SIP_DEFAULT_EXTENSION', '100'),
      evacSlot: envInt('SIP_EVAC_ANNOUNCE_SLOT', 2),
      timeoutMs: envInt('SIP_HTTP_TIMEOUT_MS', 10000),
      slots: parseAnnouncementSlots(),
    },
    commands: {
      /** When true, still queue HTTP commands to Pi if MQTT publish fails */
      httpFallback: envBool('COMMAND_HTTP_FALLBACK', true),
    },
  };

  return cached;
}

/** Safe summary for dashboard / debug (no secrets) */
export function getIntegrationsPublic() {
  const c = getIntegrations();
  return {
    mqtt: {
      enabled: c.mqtt.enabled,
      url: c.mqtt.url,
      topicPrefix: c.mqtt.topicPrefix,
      hasAuth: Boolean(c.mqtt.user),
    },
    sip: {
      enabled: c.sip.enabled,
      mode: c.sip.mode,
      httpConfigured: Boolean(c.sip.httpUrl),
      httpUrl: c.sip.httpUrl ? maskUrl(c.sip.httpUrl) : null,
      mqttTopic: c.sip.mqttTopic,
      defaultExtension: c.sip.defaultExtension,
      evacSlot: c.sip.evacSlot,
      announcementCount: c.sip.slots.length,
    },
    announcements: c.sip.slots.map(({ slot, label, sipRef, mp3, file }) => ({
      slot,
      label,
      sipRef: sipRef ?? String(slot),
      mp3: mp3 ?? file ?? `${sipRef ?? slot}.mp3`,
    })),
    commands: c.commands,
  };
}

function maskUrl(url) {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}${u.pathname}`;
  } catch {
    return '(configured)';
  }
}

export function findAnnouncementSlot(slot) {
  const n = Number(slot);
  return getIntegrations().sip.slots.find((s) => Number(s.slot) === n);
}
