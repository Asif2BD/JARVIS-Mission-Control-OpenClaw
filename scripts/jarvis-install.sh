#!/usr/bin/env bash
# jarvis-install.sh — Install jarvis CLI globally via symlink
# Run from any directory: bash /path/to/scripts/jarvis-install.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
JARVIS_JS="$SCRIPT_DIR/jarvis.js"
TARGET="/usr/local/bin/jarvis"

if [ ! -f "$JARVIS_JS" ]; then
  echo "❌ Error: $JARVIS_JS not found." >&2
  exit 1
fi

# Ensure executable
chmod +x "$JARVIS_JS"

# Symlink
if [ -L "$TARGET" ] || [ -f "$TARGET" ]; then
  echo "→ Removing existing: $TARGET"
  rm -f "$TARGET"
fi

ln -s "$JARVIS_JS" "$TARGET"
echo "✔ jarvis installed → $TARGET"
echo ""
echo "Configure your environment:"
echo "  export AGENT_ID=tank"
echo "  export MC_API_URL=http://localhost:3000   # optional, this is the default"
echo ""
echo "Quick test:"
echo "  jarvis --help"
echo "  jarvis tasks"
echo "  jarvis squad"
