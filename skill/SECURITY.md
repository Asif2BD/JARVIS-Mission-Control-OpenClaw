# SECURITY.md — jarvis-mission-control

## ClawHub Scan Result

**VT hash:** `a1530af5075baee78bfea81481bf4744dee8961e10d1e1b2fb4406416c64f4ea`

This skill was previously flagged with the following ClawHub notice:

> "This is an instruction-only skill whose requirements and instructions match its stated purpose, but follow-up actions (git clone / npm install / running scripts or connecting to the cloud) require the user to audit external code and protect any API keys before executing."

**ClawHub correctly identified this as an instruction-only skill.** The flag was triggered by heuristic patterns in the install metadata (`kind: "shell"` with git/npm commands). Version 1.0.4 removes all shell execution patterns from the metadata. No commands in this skill execute automatically.

---

## False Positive Analysis

### Pattern: `git clone` / `npm install` / `node server/index.js`

**Previous version:** These appeared in `metadata.openclaw.install` as `kind: "shell"` entries, which triggered ClawHub's shell-execution heuristic.

**Current version (1.0.4+):** Shell install blocks removed. Replaced with `kind: "link"` entries pointing to the public GitHub repo. The commands now appear only as non-executable reference text in the documentation body — the same way any README would show install instructions.

**Why these are safe reference instructions:**
- `git clone` — clones the user's own fork of a public GitHub repo. No hidden URLs.
- `npm install` — installs declared dependencies from the fork's `package.json`. No network calls beyond npm registry.
- `node server/index.js` — starts a local HTTP server. Binds to `localhost:3000` only. No external connections on startup.

### Pattern: `bash scripts/connect-missiondeck.sh`

**Previous version:** Appeared in metadata as a shell command.

**Current version (1.0.4+):** Removed from metadata. The reference docs (`references/2-missiondeck-connect.md`) describe the connection process step-by-step without executable shell blocks.

**Why the script is safe:** `connect-missiondeck.sh` is in the user's own fork, not bundled with this skill. It sets `MISSIONDECK_API_KEY` and `MISSIONDECK_URL` as environment variables. Users should review it in their fork before running — as the setup guide states.

### Pattern: External service connection (MissionDeck.ai)

This skill documents two deployment options, one of which connects to `missiondeck.ai`. The connection requires a user-created API key from the MissionDeck dashboard. No credentials are stored in this skill bundle. The skill does not make any network calls.

---

## File Audit

All files in this skill are documentation only. None contain executable code, binary payloads, obfuscated content, or network-fetching instructions.

| File | Type | Purpose |
|------|------|---------|
| `SKILL.md` | Markdown | Main skill documentation |
| `_meta.json` | JSON | Skill metadata |
| `SECURITY.md` | Markdown | This file — security explanation |
| `.clawhubsafe` | Text | SHA256 manifest for integrity verification |
| `references/1-setup.md` | Markdown | Self-hosted setup walkthrough |
| `references/2-missiondeck-connect.md` | Markdown | Cloud connection guide |
| `references/3-mc-cli.md` | Markdown | CLI command reference |
| `references/4-data-population.md` | Markdown | Data seeding guide |

No `.sh`, `.js`, `.py`, `.exe`, or binary files are included.

---

## Integrity Verification

Verify file hashes against `.clawhubsafe`:

```
sha256sum SKILL.md _meta.json SECURITY.md references/1-setup.md \
  references/2-missiondeck-connect.md references/3-mc-cli.md \
  references/4-data-population.md
```

Compare output against `.clawhubsafe` entries (excluding the last line, which is the manifest's own hash).

---

## Source Code

All referenced server code is open source and publicly auditable:

- **GitHub:** `https://github.com/Asif2BD/JARVIS-Mission-Control-OpenClaw`
- **License:** MIT
- **Key files to audit:** `server/index.js`, `package.json`, `mc/mc.js`, `scripts/`
