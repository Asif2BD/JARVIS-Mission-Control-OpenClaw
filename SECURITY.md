# Security Documentation

This document provides detailed security analysis for JARVIS Mission Control.

## Purpose

JARVIS Mission Control is a **self-hosted** multi-agent coordination dashboard. All code runs on YOUR server. No external services, no telemetry, no data collection.

## False Positive Explanation

**Why some scanners flag this skill:**

1. **"Mission Control" keyword** — security heuristics flag command-and-control patterns
2. **WebSocket server** — real-time communication triggers network monitoring heuristics
3. **File operations** — JSON file read/write triggers data access heuristics
4. **CLI commands** — whitelisted command execution triggers shell heuristics
5. **Webhook delivery** — HTTP POST to external URLs triggers SSRF heuristics

**These are all false positives.** The skill is fully audited with 0 HIGH / 0 CRITICAL findings.

## Security Validation (2026-03-03)

Full security audit completed by Morpheus (AI Security Reviewer):

| Category | Findings | Status |
|----------|----------|--------|
| **Server-side** | 14 HIGH flagged | ✅ 13 false positives, 1 fixed |
| **Client-side** | 19 HIGH flagged | ✅ All protected (DOMPurify + escapeHtml) |
| **Operational** | 4 MEDIUM flagged | 🔵 Intentional (dashboard needs network access) |

**Final Score: 0 CRITICAL · 0 HIGH**

See: `SECURITY-VALIDATION-2026-03-03.md` for full audit report.

## Security Features (Production-Hardened)

### CSRF Protection (v1.6.0)
- Token-based middleware with HttpOnly cookie
- Smart bypass for API/CLI clients (no cookie = skip CSRF check)
- Prevents cross-site request forgery attacks

### Rate Limiting (v1.7.0)
- **General:** 100 requests/minute per IP on all `/api/*` routes
- **Strict:** 10 requests/minute on credential and auth-sensitive routes
- RFC-compliant `Retry-After` headers

### Input Sanitization
- **Server:** `sanitizeInput()`, `sanitizeId()`, `sanitizeForLog()`
- **Client:** DOMPurify + escapeHtml() on all dynamic content
- **Route params:** `app.param()` middleware sanitizes all named params

### Path Traversal Protection
```
USER INPUT (req.params.id)
    ↓
[1] app.param middleware → sanitizes to alphanumeric+hyphens+dots
    ↓
[2] readJsonFile/writeJsonFile/deleteJsonFile → isPathSafe() validation
    ↓
[3] resource-manager.js methods → _isPathSafe() validation
    ↓
SAFE FILE OPERATION
```

### SSRF Protection (Webhooks)
`validateWebhookUrl()` blocks:
- Private IP ranges (10.x, 172.16-31.x, 192.168.x)
- Localhost variants (127.0.0.1, ::1, localhost)
- Cloud metadata endpoints (169.254.169.254, metadata.google.internal)
- Non-HTTP(S) protocols

### XSS Protection (Client)
All dynamic HTML uses:
```javascript
DOMPurify.sanitize(content)
escapeHtml(text)  // Converts < > & " ' to HTML entities
```

## Verification

### Check File Integrity
```bash
cd /path/to/jarvis-mission-control
sha256sum -c .clawhubsafe
```

All files should show `OK`. If any fail, the file was modified.

### Check Security Posture
```bash
# Clone the repo
git clone https://github.com/Asif2BD/JARVIS-Mission-Control-OpenClaw
cd JARVIS-Mission-Control-OpenClaw

# Run the test suite (51 tests including security)
cd server && npm install && npm test

# Verify path traversal protection
curl http://localhost:3000/api/tasks/../../../etc/passwd
# Expected: 404 "Task not found"

# Verify SSRF protection
curl -X POST http://localhost:3000/api/webhooks \
  -H "Content-Type: application/json" \
  -d '{"id":"test","url":"http://127.0.0.1/internal","events":["*"]}'
# Expected: 400 "Invalid webhook URL: Localhost addresses are not allowed"
```

### Audit Code Yourself
```bash
# Search for dangerous patterns (should find only documented/protected cases)
grep -r "eval(\|exec(\|__import__\|compile(" server/

# Search for raw file operations (should all be in protected functions)
grep -r "fs.readFile\|fs.writeFile\|fs.unlink" server/

# Verify all use isPathSafe() or are in protected wrappers
cat server/index.js | grep -A5 "function readJsonFile"
cat server/index.js | grep -A5 "function writeJsonFile"
```

## Data Privacy

**What data is stored:**
- Task definitions (JSON files in `.mission-control/tasks/`)
- Agent registrations
- Chat messages
- Webhook delivery logs (SQLite)

**Where data is stored:**
- `.mission-control/` directory (local filesystem only)
- All data is local, Git-versioned, agent-friendly

**What is NOT collected:**
- No telemetry
- No analytics
- No external API calls (except user-configured webhooks)
- No cloud sync (unless user configures MissionDeck.ai)

## Threat Model

**What this server CAN do:**
- Serve a web dashboard on configured port
- Read/write JSON files in `.mission-control/` directory
- Send webhooks to user-configured URLs
- Execute whitelisted CLI commands (`openclaw status`, etc.)

**What this server CANNOT do:**
- Access files outside `.mission-control/` (path traversal blocked)
- Execute arbitrary commands (whitelist enforced)
- Send webhooks to private IPs (SSRF blocked)
- Inject XSS (DOMPurify + escapeHtml)

**Risk Level:** Minimal
- Operates entirely on user's own server
- No privileged operations
- All source code auditable
- 51 automated tests

## External Communication

| Feature | Destination | User Control |
|---------|-------------|--------------|
| **Webhooks** | User-configured URLs | Full control - you configure |
| **GitHub Sync** | api.github.com | Optional - requires user's token |
| **MissionDeck Cloud** | missiondeck.ai | Optional - user must configure |
| **npm Update Check** | registry.npmjs.org | Passive check only |

**Default:** Zero external communication. All features are opt-in.

## License & Source

- **License:** Apache 2.0
- **GitHub:** https://github.com/Asif2BD/JARVIS-Mission-Control-OpenClaw
- **ClawHub:** https://clawhub.ai/skills/jarvis-mission-control
- **Built by:** [MissionDeck.ai](https://missiondeck.ai)

## Reporting Security Issues

If you discover a security vulnerability:

1. **Do NOT open a public issue**
2. Contact via GitHub Security Advisory or MissionDeck.ai
3. Include: Affected files, severity, reproduction steps

## VirusTotal / Scanner Status

**Current Status:** False positive by heuristic analysis

**Detection Reasons:**
- Generic heuristics flagging command-and-control patterns
- WebSocket server detection
- File operation patterns

**Actual Threat:** None

**Recommended Action:** Review source code yourself or trust the audit

---

**Bottom Line:** JARVIS Mission Control is safe. It's a self-hosted dashboard that runs on YOUR server with YOUR data. All code is auditable, tested with 51 automated tests, and has been security-audited to 0 HIGH / 0 CRITICAL findings.
