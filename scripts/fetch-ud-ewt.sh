#!/usr/bin/env bash
# Fetches the UD_English-EWT test split for bench/accuracy.test.ts.
#
# Source: UniversalDependencies/UD_English-EWT, licensed CC BY-SA 4.0.
# https://github.com/UniversalDependencies/UD_English-EWT
set -euo pipefail

# Pinned commit — bump deliberately, not on every run.
SHA="4a4d77f599ea53cc405f85d0cec4b2f14f81d42b"
URL="https://raw.githubusercontent.com/UniversalDependencies/UD_English-EWT/${SHA}/en_ewt-ud-test.conllu"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATA_DIR="${ROOT}/bench/data"
OUT_FILE="${DATA_DIR}/en_ewt-ud-test.conllu"

mkdir -p "${DATA_DIR}"

if [[ -f "${OUT_FILE}" ]]; then
  echo "already present: ${OUT_FILE}"
else
  curl -fsSL "${URL}" -o "${OUT_FILE}"
fi

echo "${OUT_FILE}"
wc -l < "${OUT_FILE}"
