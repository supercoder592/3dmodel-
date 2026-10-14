#!/usr/bin/env bash
# Starts the Hunyuan3D API server (:8081) and the text-to-image sidecar (:7860).
# Then run the web app with HUNYUAN_URL=http://127.0.0.1:8081 T2I_URL=http://127.0.0.1:7860
set -euo pipefail
cd "$(dirname "$0")"
source Hunyuan3D-2.1/.venv/bin/activate

EXTRA=()
[ "${HUNYUAN_LOW_VRAM:-0}" = "1" ] && EXTRA+=(--low_vram_mode)

( cd Hunyuan3D-2.1 && python api_server.py --host 0.0.0.0 --port "${HUNYUAN_PORT:-8081}" "${EXTRA[@]}" ) &
HY=$!

if [ "${T2I_DISABLE:-0}" != "1" ]; then
  python t2i_server.py &
  T2I=$!
fi

trap 'kill $HY ${T2I:-} 2>/dev/null || true' EXIT INT TERM
wait
