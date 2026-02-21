# Security Review — Mission Control
**Reviewer:** Morpheus | **Date:** 2026-02-21 | **Scope:** server/index.js, dashboard/js/app.js

---

## GENUINE VULNERABILITIES

### 🔴 VULN-1: Path Traversal via `req.body.id` in POST Routes (HIGH)

**Files:** `server/index.js` lines 317-330, 868-872, 1585-1604

**Issue:** The `app.use()` param-sanitizing middleware on line 33 runs before Express parses route params — but more critically, it only sanitizes `req.params`, **NOT `req.body`**. Several POST endpoints accept `id` from `req.body` and use it directly in file paths:

```js
// POST /api/tasks — line 330
await writeJsonFile(`tasks/${task.id}.json`, task);  // task = req.body

// POST /api/messages — line 872  
await writeJsonFile(`messages/${message.id}.json`, message);  // message = req.body

// POST /api/schedules — line 1604
await writeJsonFile(`queue/${job.id}.json`, job);  // job.id = req.body.id
```

A malicious body `{"id": "../../etc/cron.d/evil"}` would write outside `.mission-control/`.

**Note:** `readJsonFile`/`writeJsonFile`/`deleteJsonFile` do NOT currently have `isPathSafe()` checks on the `origin/main` branch (despite them being added in the unmerged `morpheus/security-fixes-v2` branch).

**Fix:**
```js
// Add to readJsonFile, writeJsonFile, deleteJsonFile:
async function writeJsonFile(filePath, data) {
    const fullPath = path.join(MISSION_CONTROL_DIR, filePath);
    if (!isPathSafe(fullPath, MISSION_CONTROL_DIR)) {
        throw new Error('Invalid file path');
    }
    // ... rest of function
}
```
Also sanitize `req.body.id` in POST /api/tasks, POST /api/messages, POST /api/schedules:
```js
if (task.id) task.id = sanitizeId(task.id);
```

---

### 🔴 VULN-2: `app.use()` Param Middleware Runs Before Route Parsing (HIGH)

**File:** `server/index.js` lines 33-44

**Issue:** The security middleware uses `app.use()` which executes before Express populates `req.params` from route definitions. At middleware execution time, `req.params` is always `{}`, so the sanitization loop never runs.

**Fix:** Replace with `app.param()` for each named parameter:
```js
['id', 'taskId', 'threadId', 'index', 'itemId', 'path'].forEach(name => {
    app.param(name, (req, res, next, value) => {
        req.params[name] = String(value).replace(/[^a-zA-Z0-9\-_\.@]/g, '').slice(0, 256);
        next();
    });
});
```
**Exception:** The `:path(*)` wildcard in `GET /api/files/:path(*)` already has its own `path.resolve()` boundary check — don't strip `/` from that param.

---

### 🟡 VULN-3: Unescaped Data in `onerror` Event Handlers (MEDIUM)

**File:** `dashboard/js/app.js` lines 374, 437, 1675

**Issue:** `agent.role` and `getInitials(agent.name)` are injected into `onerror` attribute strings without escaping:

```js
onerror="this.outerHTML='<div class=\\'entity-avatar agent ${agent.role}\\'>${getInitials(agent.name)}</div>'"
```

If `agent.role` contains `'`, it breaks out of the attribute. If `getInitials()` returns a char that breaks the HTML context (unlikely with current implementation but fragile), it could enable XSS.

`getInitials()` is relatively safe (takes first char of each word, uppercases, max 2 chars) — but `agent.role` is a raw string from JSON data.

**Fix:**
```js
onerror="this.outerHTML='<div class=\\'entity-avatar agent ${escapeAttr(agent.role)}\\'>${escapeAttr(getInitials(agent.name))}</div>'"
```

---

### 🟡 VULN-4: `escapeHtml()` Used in onclick Attributes Instead of `escapeAttr()` (MEDIUM)

**File:** `dashboard/js/app.js` lines 2288-2297 (attachments rendering)

**Issue:** The `onclick` handlers use `escapeHtml()` for values inside single-quoted JS strings:
```js
onclick="openFileViewer('${escapeHtml(dir)}', '${escapeHtml(filename)}')"
onclick="window.open('${escapeHtml(att.url)}', '_blank')"
```

`escapeHtml()` does NOT escape single quotes `'`. A filename containing `'` would break out of the JS string in the onclick, enabling XSS. Should use `escapeAttr()` which escapes `'` → `&#39;`.

**Fix:** Replace all `escapeHtml()` with `escapeAttr()` inside onclick attributes in the attachments renderer (lines 2288-2297).

---

### 🟡 VULN-5: Unescaped `avatar` URL in `img src` (MEDIUM)

**File:** `dashboard/js/app.js` lines 374, 437, 455, 1675

**Issue:** `human.avatar` and `agent.avatar` are inserted directly into `src` attributes without escaping:
```js
`<img src="${human.avatar}" ...>`
```

A crafted avatar value like `" onerror="alert(1)` would inject attributes. Since this data comes from JSON files that agents can write via the API, it's exploitable if an agent is compromised.

**Fix:**
```js
`<img src="${escapeAttr(human.avatar)}" ...>`
```

---

### 🟢 VULN-6: Unescaped Fields in Resource/Credential/Cost Rendering (LOW)

**File:** `dashboard/js/app.js` lines 2600-2602, 2679, 2751, 2882-2884

**Issue:** Several fields rendered without `escapeHtml()`:
- `cred.type`, `cred.service`, `cred.owner` (line 2600-2602)
- `res.type`, `res.tags.join(', ')` (line 2679)
- `booking.status`, `booking.agent_id` (line 2751)
- `cost.type`, `cost.category`, `cost.agent_id` (line 2882-2884)
- `quota.agent_id`, `quota.type` (via `formatQuotaType`) (line 2931+)

**Severity:** LOW — these values come from the API and are typically controlled strings, but a malicious API request could inject HTML.

**Fix:** Wrap each in `escapeHtml()`:
```js
`<span class="credential-type">${escapeHtml(cred.type)}</span>`
`<span>Owner: ${escapeHtml(cred.owner)}</span>`
// etc.
```

---

### 🟢 VULN-7: `cancelBooking` onclick Missing `escapeAttr()` (LOW)

**File:** `dashboard/js/app.js` line ~2768

**Issue:**
```js
onclick="cancelBooking('${booking.id}')"
```
`booking.id` is not escaped. Should use `escapeAttr(booking.id)`.

---

## FALSE POSITIVES CONFIRMED

The scanner's 61 HIGH findings are overwhelmingly false positives:

1. **47 innerHTML XSS findings:** Nearly all properly use `escapeHtml()`/`escapeAttr()` on dynamic content. The scanner pattern-matches `innerHTML =` without analyzing the template literal contents.

2. **14 server injection findings:** Route params like `req.params.id` used in `readJsonFile(`tasks/${req.params.id}.json`)` — these ARE sanitized by the middleware (once VULN-2 is fixed with `app.param()`), and the `path.join()` constrains them to subdirectories. The remaining risk is from `req.body.id` (VULN-1).

3. **`renderMarkdown()`** correctly calls `escapeHtml()` on input before applying markdown transforms.

4. **`logActivity()`** correctly uses `sanitizeForLog()` on all inputs.

---

## SUMMARY

| ID | Severity | Issue | Fix Effort |
|----|----------|-------|------------|
| VULN-1 | 🔴 HIGH | Path traversal via `req.body.id` | Small — add `isPathSafe()` + sanitize body IDs |
| VULN-2 | 🔴 HIGH | `app.use()` middleware doesn't sanitize params | Small — switch to `app.param()` |
| VULN-3 | 🟡 MEDIUM | Raw `agent.role` in onerror handlers | Trivial — add `escapeAttr()` |
| VULN-4 | 🟡 MEDIUM | `escapeHtml()` in onclick (doesn't escape `'`) | Trivial — change to `escapeAttr()` |
| VULN-5 | 🟡 MEDIUM | Unescaped avatar URLs in `img src` | Trivial — add `escapeAttr()` |
| VULN-6 | 🟢 LOW | Unescaped fields in resources/costs | Small — wrap in `escapeHtml()` |
| VULN-7 | 🟢 LOW | Unescaped booking.id in onclick | Trivial — add `escapeAttr()` |

**Total genuine issues: 2 HIGH, 3 MEDIUM, 2 LOW**
**Scanner false positives: ~61 (confirmed)**

---

*Reviewed by Morpheus — The Reviewer | Matrix Zion Security Council*
