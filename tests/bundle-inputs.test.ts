import { afterEach, describe, expect, it } from "vitest";
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

function check(inputs: unknown, queryFails = false) {
  const root = mkdtempSync(path.join(tmpdir(), "yaae-metafile-test-"));
  roots.push(root);
  const meta = path.join(root, "meta.json");
  writeFileSync(meta, JSON.stringify({ inputs }));
  const env = { ...process.env };
  if (queryFails) {
    const bin = path.join(root, "bin");
    mkdirSync(bin);
    const jq = path.join(bin, "jq");
    writeFileSync(jq, '#!/bin/sh\nif [ "$1" = "-er" ]; then echo 10; else exit 7; fi\n');
    chmodSync(jq, 0o755);
    env.PATH = `${bin}:${process.env.PATH}`;
  }
  return spawnSync("bash", [path.join(__dirname, "../scripts/check-bundle-inputs.sh"), meta], { encoding: "utf8", env });
}

function cleanInputs() {
  return Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`src/file${i}.ts`, { bytes: 1 }]));
}

describe("bundle input provenance", () => {
  it("accepts an object of clean input paths", () => {
    const result = check(cleanInputs());
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("PASS: 10 bundle inputs");
  });

  it("fails closed when the input-path query fails", () => {
    const result = check(cleanInputs(), true);
    expect(result.status).toBe(2);
    expect(result.stdout).not.toContain("PASS:");
    expect(result.stderr).toContain("could not inspect metafile input paths");
  });

  it.each(["bench/taggers.ts", "node_modules/.pnpm/compromise@14.14.5/node_modules/compromise/index.js"])(
    "rejects forbidden input %s", (input) => {
      const result = check({ ...cleanInputs(), [input]: { bytes: 1 } });
      expect(result.status).toBe(1);
      expect(result.stdout).toContain(input);
    });

  it.each([
    { label: "array", inputs: Array.from({ length: 10 }, (_, i) => i) },
    { label: "null", inputs: null },
    { label: "string", inputs: "not an input map" },
  ])(
    "refuses malformed $label inputs without reporting PASS", ({ inputs }) => {
      const result = check(inputs);
      expect(result.status).toBe(2);
      expect(result.stdout).not.toContain("PASS:");
      expect(result.stderr).toContain("FAIL:");
    });
});
