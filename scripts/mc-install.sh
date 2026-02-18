#!/usr/bin/env bash
set -euo pipefail
MC_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ln -sf "$MC_DIR/scripts/mc" /usr/local/bin/mc
echo "✅ mc installed to /usr/local/bin/mc"
echo "   Run: mc --help"
