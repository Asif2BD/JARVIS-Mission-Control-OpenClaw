# Security Fix Plan - Mission Control
**Morpheus Review | 2026-03-03**

## Summary
Fixing 37 security findings from Security Council scan.

## Issues Breakdown

### ✅ Already Protected
- **app.param middleware (lines 39-45)**: Auto-sanitizes all route params including `id`
- **Client-side XSS (19 findings)**: All innerHTML uses protected by DOMPurify.sanitize() + escapeHtml()
- **Path traversal utilities**: sanitizeId(), isPathSafe() already exist

### 🔧 Needs Explicit Protection
**Server-side file operations (14 HIGH):**
- Lines 320, 474, 516, 517, 534, 574, 611, 646, 736, 1016, 1216, 1736, 1759, 1760
- Issue: File paths use req.params.id but don't explicitly validate with isPathSafe()
- Fix: Add safeReadJsonFile() and safeWriteJsonFile() wrappers with explicit path validation

### ℹ️ Operational (4 MEDIUM)
- Port 3000 on 0.0.0.0 (intentional for dashboard access)
- Port 631 (CUPS - system service, not our control)

## Implementation

### 1. Create Safe File I/O Wrappers
```javascript
/**
 * Safely read JSON file with explicit path validation
 */
async function safeReadJsonFile(relativePath) {
    const fullPath = path.join(MISSION_CONTROL_DIR, relativePath);
    
    // Explicit path traversal protection
    if (!isPathSafe(fullPath, MISSION_CONTROL_DIR)) {
        throw new Error('Path traversal attempt detected');
    }
    
    const data = await fs.readFile(fullPath, 'utf8');
    return JSON.parse(data);
}

/**
 * Safely write JSON file with explicit path validation
 */
async function safeWriteJsonFile(relativePath, data) {
    const fullPath = path.join(MISSION_CONTROL_DIR, relativePath);
    
    // Explicit path traversal protection
    if (!isPathSafe(fullPath, MISSION_CONTROL_DIR)) {
        throw new Error('Path traversal attempt detected');
    }
    
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, JSON.stringify(data, null, 2), 'utf8');
}
```

### 2. Replace All File Operations
- Replace `readJsonFile()` with `safeReadJsonFile()` at all 14 server locations
- Replace `writeJsonFile()` with `safeWriteJsonFile()` where applicable

### 3. Testing
- Attempt path traversal: `GET /api/tasks/../../../etc/passwd`
- Verify rejection with 400/403 error
- Verify legitimate IDs still work

## Expected Result
- 🟢 0 CRITICAL | 0 HIGH | 4 MEDIUM | 0 LOW
- All file operations explicitly protected
- Security Council happy
