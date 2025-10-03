
# PROJECT-RULES.md

This document defines **project-specific rules** for the Node.js WebSocket API Server project.  
Follow these alongside the **global AGENTS.md**.

---

## 1) Repository Scope

- Standalone **Node.js WebSocket API server**
- Hosted on a dedicated VM
- Provides **real-time messaging, streaming, and inference orchestration**
- Includes demo interface, scripts, and documentation

---

## 2) Project Rules

### WebSocket Server
- Use one library consistently (`ws` preferred).
- All messages follow strict JSON format:
  ```json
  { "type": "ACTION", "payload": {...} }
  ```
- Must handle:
  - `connection`
  - `disconnect`
  - `message`
  - `error`
- Use `broadcastMessage()` helper for fan-out.

### Authentication
- Token-based (JWT or API key).
- Reject unauthorized connections at handshake.

### Pub/Sub Broker
- Redis or NATS integration for horizontal scaling.
- Workers subscribe to inference topics.

### Inference Bridge
- Supports async requests with timeout + retry.
- Error responses structured as JSON:
  ```json
  { "error": "message", "code": 500 }
  ```
- Log round-trip times for telemetry.
- Pluggable connectors (REST, gRPC, WebSocket).

### Demo UI (public/demo.*)
- Clean, responsive interface.
- Provide Connect/Disconnect, Ping, Broadcast, Inference Request actions.
- Show live logs of sent/received messages.
- Status indicator: connected/disconnected.

### Documentation
- `/docs/README.md`: Overview, install, deploy
- `/docs/ARCHITECTURE.md`: System design, scaling
- `/docs/API-REFERENCE.md`: Message types, lifecycle

### Scripts
- `/scripts/setup.sh`: Provision empty VM
- `/scripts/deploy.sh`: Deploy with PM2/systemd

---

## 3) Deliverables

Each task must ensure:

- **Production-ready code**
- **Docs updated** (README, ARCHITECTURE, API-REFERENCE)
- **Demo tested** (UI works for all message types)
- **Progress logged** in `/progress-tracker.md`

---

## 4) Task Intake Checklist

- Confirm repo path and environment
- Review related files before coding
- Identify minimal change set
- Log changes and open questions in `/progress-tracker.md`

---

## 5) Project Quick Commands

- Install: `pnpm install`  
- Dev: `pnpm dev`  
- Test: `pnpm test`  
- Lint/Format: `pnpm lint && pnpm format`  

