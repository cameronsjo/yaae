#!/usr/bin/env bash
# Fetches the UD_English-EWT test split for bench/accuracy.test.ts.
#
# Source: UniversalDependencies/UD_English-EWT, licensed CC BY-SA 4.0.
# https://github.com/UniversalDependencies/UD_English-EWT
set -euo pipefail

# Pinned commit — bump deliberately, not on every run.
SHA="4a4d77f599ea53cc405f85d0cec4b2f14f81d42b"
URL="https://raw.githubusercontent.com/UniversalDependencies/UD_English-EWT/${SHA}/en_ewt-ud-test.conllu"
# Digest of the file at that commit. The URL pins content at GitHub; this pins
# it independently of the host, so a MITM or a compromised mirror fails closed.
# Bump alongside SHA: shasum -a 256 bench/data/en_ewt-ud-test.conllu
SHA256="fa024f43dc5da3c5ac02563bc9bd0e974f46cbb1560823976a8f342a37dc494a"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATA_DIR="${ROOT}/bench/data"
OUT_FILE="${DATA_DIR}/en_ewt-ud-test.conllu"

mkdir -p "${DATA_DIR}"

verify_corpus() {
  local file="$1"
  if ! echo "${SHA256}  ${file}" | shasum -a 256 -c --status; then
    echo "checksum mismatch for ${file}" >&2
    echo "expected ${SHA256}, got $(shasum -a 256 < "${file}" | cut -d' ' -f1)" >&2
    return 1
  fi
}

if [[ -f "${OUT_FILE}" ]]; then
  # A cached file is measurement input too. Refuse stale/corrupted data rather
  # than silently scoring it, and retain it so the caller can inspect it.
  verify_corpus "${OUT_FILE}"
  echo "already present: ${OUT_FILE}"
else
  TMP_FILE="$(mktemp "${DATA_DIR}/.en_ewt-ud-test.XXXXXX")"
  trap 'rm -f "${TMP_FILE}"' EXIT
  curl -fsSL "${URL}" -o "${TMP_FILE}"
  verify_corpus "${TMP_FILE}"
  mv "${TMP_FILE}" "${OUT_FILE}"
fi

echo "${OUT_FILE}"
wc -l < "${OUT_FILE}"
