# SCS HTTP API reference

Base URL: `http://localhost:3001` (or your server host)

Most operator endpoints require a **session cookie** after `POST /api/auth/login`.

Device endpoints use header **`X-Device-Key: <secret>`** (must match `PI_DEVICE_KEY` or `PI_DEVICE_KEYS` on the server).

---

## Authentication

### POST /api/auth/login

```json
{ "username": "operator", "password": "scs-operator" }
```

Sets session cookie. Credentials from `OPERATOR_USERNAME` / `OPERATOR_PASSWORD` in `server/.env`.

### POST /api/auth/logout

Clears session.

### GET /api/auth/me

Returns current operator if logged in; `401` if not.

---

## Towers (operator)

### GET /api/towers

List all towers with live state (battery, GPS, devices, camera, online flag).

**Auth:** session required

### GET /api/integrations

Public integration summary (MQTT/SIP enabled, topics, announcement slots). Passwords are not returned.

**Auth:** session required

---

## Commands (operator)

### POST /api/commands

```json
{
  "towerIds": ["TWR-001"],
  "action": "beacon_flash",
  "payload": { "intervalMs": 500 }
}
```

Common `action` values:

| action | payload | Notes |
|--------|---------|-------|
| `evacuation` | `{}` | Emergency + optional SIP |
| `announcement` | `{ "slot": 2 }` | PA slot 1–10 |
| `beacon_flash` | `{ "intervalMs": 500 }` | |
| `stop_alerts` | `{}` | |
| `led_message` | `{ "text": "HELLO" }` | |
| `reboot` | `{}` | Pi reboot |

Delivery: MQTT publish (if enabled) + HTTP command queue on Pi telemetry poll + SIP trigger when configured.

### POST /api/evacuation

Global evacuation for all online towers.

---

## Device (Pi / simulator)

### POST /api/device/telemetry

Pi or simulator posts tower state.

**Header:** `X-Device-Key: pi4-twr-001-key`

**Body (example):**

```json
{
  "towerId": "TWR-SIM-001",
  "towerName": "Simulated Tower 1",
  "battery": { "percent": 72, "voltage": 12.4 },
  "signal": { "rssi": -65, "connected": true },
  "location": { "lat": -32.0781, "lng": 115.7589, "label": "Fremantle Beach (South), Perth WA" },
  "devices": { "beacon": false, "led": "idle", "speaker": "ok" }
}
```

Response may include `pendingCommands` for the agent to execute.

### POST /api/device/commands/:id/ack

Acknowledge a delivered command.

---

## Debug

### GET /api/debug/status

Full server diagnostic JSON: towers, connections, MQTT, integrations summary, recent commands.

**Auth:** session required (debug page uses this)

---

## Static pages

| Path | File |
|------|------|
| `/` | Dashboard |
| `/login.html` | Login |
| `/debug.html` | Debug UI |

---

## Environment-driven behaviour

| Setting | Effect on API |
|---------|----------------|
| `PI_DEVICE_KEY` | Auth for default tower |
| `PI_DEVICE_KEYS` | Extra `TWR-ID:key` pairs |
| `SIM_TWR_002_KEY` | Auth for `TWR-SIM-002` |
| `MQTT_*` | Command publish to broker |
| `SIP_*` | HTTP/MQTT trigger on announcement/evacuation |
| `TOWER_OFFLINE_MS` | When `online` becomes false |

See [INTEGRATIONS.md](INTEGRATIONS.md) for MQTT/SIP variables.
