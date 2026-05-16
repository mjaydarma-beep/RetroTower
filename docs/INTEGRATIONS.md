# MQTT & SIP integration guide

Configure **external MQTT** and **SIP/PA** servers in one file: **`server/.env`**.  
Restart after changes:

```powershell
cd d:\SCS_Project\server
npm start
```

---

## Architecture

```
Dashboard button
      │
      ▼
POST /api/commands  (operator login)
      │
      ▼
commandService.js
      ├── MQTT  →  broker  →  Raspberry Pi / LED
      ├── SIP   →  HTTP or MQTT  →  PA / Asterisk / gateway
      └── HTTP queue  →  Pi telemetry poll (fallback)
```

---

## MQTT settings

| Variable | Default | Description |
|----------|---------|-------------|
| `MQTT_ENABLED` | `true` | Set `false` to disable broker connection |
| `MQTT_URL` | `mqtt://127.0.0.1:1883` | Broker URL |
| `MQTT_USER` | (empty) | Username |
| `MQTT_PASSWORD` | (empty) | Password |
| `MQTT_TOPIC_PREFIX` | `scs/towers` | Topic root |
| `MQTT_QOS` | `1` | Publish QoS |

### Topics

| Purpose | Topic pattern |
|---------|----------------|
| Pi command | `{prefix}/{towerId}/cmd/{action}` |
| LED display | `{prefix}/{towerId}/led/display` |

Example: `scs/towers/TWR-001/cmd/beacon_flash`

### Pi agent

On the Pi, set in `/etc/scs-agent.env`:

```env
MQTT_ENABLED=true
MQTT_HOST=your-broker-ip
MQTT_PORT=1883
```

---

## SIP / PA settings

| Variable | Default | Description |
|----------|---------|-------------|
| `SIP_ENABLED` | `false` | Enable SIP triggers from dashboard |
| `SIP_MODE` | `http` | `http`, `mqtt`, or `both` |
| `SIP_HTTP_URL` | (empty) | REST endpoint for announcements |
| `SIP_HTTP_METHOD` | `POST` | HTTP method |
| `SIP_HTTP_TOKEN` | (empty) | Sent as `X-Api-Key` header |
| `SIP_HTTP_BEARER` | (empty) | `Authorization: Bearer …` |
| `SIP_HTTP_TIMEOUT_MS` | `10000` | Request timeout |
| `SIP_MQTT_TOPIC` | `scs/sip/announce` | MQTT topic when mode includes mqtt |
| `SIP_DEFAULT_EXTENSION` | `100` | Default extension in payload |
| `SIP_EVAC_ANNOUNCE_SLOT` | `2` | Announcement slot for evacuation |

### HTTP example

Your SIP server should accept POST with JSON body:

```json
{
  "towerId": "TWR-001",
  "slot": 2,
  "label": "Evacuate beach",
  "sipRef": "2",
  "extension": "100",
  "timestamp": "2026-05-16T12:00:00.000Z"
}
```

`.env`:

```env
SIP_ENABLED=true
SIP_MODE=http
SIP_HTTP_URL=http://192.168.1.100:8088/api/announce
SIP_HTTP_TOKEN=my-secret-key
```

### MQTT example

SIP gateway subscribes to `scs/sip/announce` and plays audio by `sipRef` or `slot`.

```env
SIP_ENABLED=true
SIP_MODE=mqtt
MQTT_URL=mqtt://192.168.1.50:1883
SIP_MQTT_TOPIC=scs/sip/announce
```

Requires `MQTT_ENABLED=true` on the server (same broker).

### Both HTTP and MQTT

```env
SIP_ENABLED=true
SIP_MODE=both
SIP_HTTP_URL=http://pbx/api/announce
SIP_MQTT_TOPIC=scs/sip/announce
```

---

## Announcement slots (dashboard)

Default slots 1–10 are built in. Override with:

```env
ANNOUNCEMENT_SLOTS_JSON=[{"slot":1,"label":"All clear","sipRef":"track-01"},{"slot":2,"label":"Evacuate","sipRef":"evac-beach"}]
```

| Field | Meaning |
|-------|---------|
| `slot` | Button number on dashboard |
| `label` | Button text |
| `sipRef` | ID your SIP system uses to pick audio file |

---

## Command delivery

| Variable | Default | Description |
|----------|---------|-------------|
| `COMMAND_HTTP_FALLBACK` | `true` | Queue command for Pi HTTP if MQTT fails |

Success if **any** of: MQTT published, SIP triggered, Pi online (HTTP queue).

---

## Verify configuration

### API (logged in)

```
GET /api/integrations
```

Returns MQTT/SIP settings (passwords hidden) and live connection status.

### Debug page

Open `/debug.html` → tower row **Raw** → inspect JSON (includes `integrations` when present in status payload).

### Server console

On start:

```text
[integrations] MQTT mqtt://127.0.0.1:1883 · SIP off
```

---

## Example: production `.env` snippet

```env
MQTT_ENABLED=true
MQTT_URL=mqtt://mqtt.mycompany.com:8883
MQTT_USER=scs-server
MQTT_PASSWORD=secret
MQTT_TOPIC_PREFIX=scs/towers

SIP_ENABLED=true
SIP_MODE=both
SIP_HTTP_URL=https://pbx.mycompany.com/api/v1/announce
SIP_HTTP_BEARER=your-jwt-token
SIP_MQTT_TOPIC=scs/sip/announce
SIP_EVAC_ANNOUNCE_SLOT=2

ANNOUNCEMENT_SLOTS_JSON=[{"slot":1,"label":"All clear","sipRef":"01"},{"slot":2,"label":"Evacuate beach","sipRef":"02"}]
```

---

## Adapting your SIP server

Your PBX or custom service should:

1. Expose HTTP POST (or subscribe to MQTT topic).
2. Map `sipRef` or `slot` to an audio file or SIP call.
3. Optionally use `towerId` to route to a site speaker zone.

The SCS server does not implement SIP/RTP directly — it only **triggers** your external system.
