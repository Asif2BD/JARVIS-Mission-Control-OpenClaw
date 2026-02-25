# Changelog

## [1.0.5] - 2026-02-25
### Added
- **Bidirectional cloud sync**: Cloud-created tasks (from MissionDeck dashboard) now sync back to local `.mission-control/tasks/` automatically
- `startCloudPull()` in `server/missiondeck-sync.js` — polls mc-api every 30s for tasks created/updated from the cloud
- Cloud tasks written as local JSON files → chokidar picks them up → webhooks fire → **Telegram notifications delivered**
- `MISSIONDECK_SLUG` env var (already written by `connect-missiondeck.sh`) used to target the correct workspace

## [1.0.4] - 2026-02-25
### Fixed
- Cloud sync endpoint now defaults to direct Supabase URL (fixes 405 errors via missiondeck.ai proxy)
- MISSIONDECK_API_URL env var override supported in both connect script and server sync

## [1.0.3] - 2026-02-24
### Fixed
- Added /verify endpoint to mc-api for API key validation
- Fixed nginx CORS headers to include X-MC-Passcode

## [1.0.2] - 2026-02-21
### Fixed
- Security patch — 10 vulnerabilities fixed
- Dependency updates

## [1.0.1] - 2026-02-10
### Added
- MissionDeck cloud sync integration
- Agent auto-discovery from OpenClaw config

## [1.0.0] - 2026-02-05
### Added
- Initial release
- File-based task management
- WebSocket real-time updates
- Telegram bridge
