#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: bundle-size.sh [file]

Reports raw and gzip byte sizes of the production bundle.

  file    Path to a file to measure. If omitted, runs `pnpm run build`
          and measures main.js.
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

if [[ $# -ge 1 ]]; then
  target="$1"
else
  pnpm run build
  target="main.js"
fi

raw_bytes=$(wc -c < "$target")
# `--` so a path beginning with `-` is an operand, not a gzip flag.
gzip_bytes=$(gzip -c -- "$target" | wc -c)

echo "raw bytes:  ${raw_bytes// /}"
echo "gzip bytes: ${gzip_bytes// /}"
