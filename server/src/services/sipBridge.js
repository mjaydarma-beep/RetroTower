/**
 * External SIP / PA announcements — HTTP API and/or MQTT trigger.
 * Configure in server/.env (see .env.example).
 */

import { getIntegrations } from '../config/integrations.js';
import { publishRaw } from './mqttBridge.js';

let lastTrigger = null;

export function getSipStatus() {
  const sip = getIntegrations().sip;
  return {
    enabled: sip.enabled,
    mode: sip.mode,
    httpUrl: sip.httpUrl || null,
    mqttTopic: sip.mqttTopic,
    lastTrigger,
  };
}

/**
 * Trigger announcement on external SIP/PA system.
 * @returns {{ sent: boolean, via?: string, error?: string }}
 */
export async function triggerSipAnnouncement({ towerId, slot, label, payload = {} }) {
  const sip = getIntegrations().sip;
  if (!sip.enabled) {
    return { sent: false, reason: 'sip_disabled' };
  }

  const slotDef = slot != null ? { slot, label, sipRef: String(slot) } : null;
  const sipRef = slotDef?.sipRef ?? String(slot ?? '');
  const body = {
    towerId,
    slot: Number(slot),
    label: label || slotDef?.label || `Announcement ${slot}`,
    sipRef,
    extension: payload.extension || sip.defaultExtension,
    timestamp: new Date().toISOString(),
    ...payload,
  };

  const results = [];
  const mode = sip.mode;

  if (mode === 'http' || mode === 'both') {
    results.push(await triggerSipHttp(body, sip));
  }
  if (mode === 'mqtt' || mode === 'both') {
    results.push(triggerSipMqtt(body, sip));
  }

  const sent = results.some((r) => r.sent);
  const via = results.filter((r) => r.sent).map((r) => r.via).join('+') || 'none';
  const error = results.find((r) => r.error)?.error;

  lastTrigger = {
    at: body.timestamp,
    towerId,
    slot: body.slot,
    sent,
    via,
    error,
  };

  if (sent) {
    console.log(`[sip] announcement tower=${towerId} slot=${slot} via=${via}`);
  } else if (sip.enabled) {
    console.warn(`[sip] announcement failed tower=${towerId} slot=${slot}`, error || results);
  }

  return { sent, via, error };
}

async function triggerSipHttp(body, sip) {
  if (!sip.httpUrl) {
    return { sent: false, via: 'http', error: 'SIP_HTTP_URL not set' };
  }

  const headers = { 'Content-Type': 'application/json' };
  if (sip.httpBearer) headers.Authorization = `Bearer ${sip.httpBearer}`;
  else if (sip.httpToken) headers['X-Api-Key'] = sip.httpToken;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), sip.timeoutMs);

  try {
    const res = await fetch(sip.httpUrl, {
      method: sip.httpMethod,
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return { sent: false, via: 'http', error: `HTTP ${res.status} ${text}`.trim() };
    }
    return { sent: true, via: 'http' };
  } catch (err) {
    clearTimeout(timer);
    return { sent: false, via: 'http', error: err.message || String(err) };
  }
}

function triggerSipMqtt(body, sip) {
  const ok = publishRaw(sip.mqttTopic, body, { qos: 1 });
  return ok
    ? { sent: true, via: 'mqtt' }
    : { sent: false, via: 'mqtt', error: 'MQTT not connected' };
}
