# AGENT.md  
Rules and conventions for AI agents working on this repository.  
This file defines **system behavior**, **scoped rules**, and **examples**.  

---

## <role name="system">
You are an AI coding agent for this repository.  
Your job is to **write, refactor, and document code** while following these rules:  

1. **Rule Compliance**
   - Always respect project rules and conventions.  
   - Apply scoped rules (via globs) if they exist for a file or directory.  
   - Do not ignore or override rules without explicit instruction.  

2. **Minimal & Scoped Changes**
   - Only modify what’s necessary.  
   - Keep edits within the requested scope.  
   - Favor modular changes (helpers, submodules, utilities).  

3. **Coding Standards**
   - Use modern JavaScript/TypeScript best practices.  
   - Follow naming conventions (camelCase for variables/functions, PascalCase for classes).  
   - Always include error handling and validation.  
   - Prefer async/await over raw promises.  

4. **Documentation & Comments**
   - Update README, docs, or API reference when introducing new features.  
   - Add inline comments for complex logic.  

5. **Testing & Safety**
   - Provide test snippets (Jest/Mocha or Node’s built-in test runner).  
   - Avoid unsafe, destructive changes without confirmation.  

6. **Iterate & Suggest**
   - If you see repeated mistakes or missing rules, propose adding/updating a rule.  
   - Improve AGENT.md incrementally based on feedback.  

</role>

---

## 📂 Rule Scopes

### WebSocket Server Rules
```yaml
globs:
  - "src/server.js"
  - "src/router.js"
description: >
  All WebSocket code must follow these rules.
rules:
  - Use `ws` or `socket.io` consistently across files.
  - Message format must always be JSON with keys: `type`, `payload`. 
  - Always handle `connection`, `disconnect`, `error`, and `message` events.
  - Broadcasts must go through a utility function (`broadcastMessage`) instead of ad-hoc loops.
  - Never block the event loop with heavy inference logic; delegate to inference workers.
```

---

### Inference Bridge Rules
```yaml
globs:
  - "src/inference-bridge.js"
description: >
  Bridge for inference VMs and external APIs.
rules:
  - Inference requests must be async with timeout/retry logic.
  - Always log round-trip times for telemetry.
  - Errors must return structured JSON: { "error": "message", "code": 500 }.
  - Keep inference connectors pluggable (support REST, gRPC, WebSocket).
```

---

### Demo UI Rules
```yaml
globs:
  - "public/demo.*"
description: >
  Demo interface for testing WebSocket APIs.
rules:
  - UI must be responsive (mobile + desktop).
  - All outbound messages must be shown in the log panel.
  - Maintain a status indicator (connected/disconnected).
  - Include buttons for: Connect, Disconnect, Ping, Broadcast, Inference Request.
```

---

## ✅ Examples

**Good Example (WebSocket message):**
```json
{ "type": "PING" }
```

**Bad Example (no type key):**
```json
{ "msg": "ping" }
```
