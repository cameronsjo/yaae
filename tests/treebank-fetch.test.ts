import { afterEach, describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

function cachedFetch(contents: string) {
  const root = mkdtempSync(path.join(tmpdir(), "yaae-treebank-test-"));
  roots.push(root);
  mkdirSync(path.join(root, "scripts"));
  mkdirSync(path.join(root, "bench/data"), { recursive: true });
  const expected = "known treebank fixture\n";
  // Substitute only the pinned data constant; execute the production shell
  // logic against a tiny fixture, without downloading/vendoring the treebank.
  const digest = createHash("sha256").update(expected).digest("hex");
  const script = readFileSync(path.join(__dirname, "../scripts/fetch-ud-ewt.sh"), "utf8")
    .replace(/^SHA256="[a-f0-9]+"$/m, `SHA256="${digest}"`);
  const scriptPath = path.join(root, "scripts/fetch-ud-ewt.sh");
  const corpusPath = path.join(root, "bench/data/en_ewt-ud-test.conllu");
  writeFileSync(scriptPath, script);
  writeFileSync(corpusPath, contents);
  const result = spawnSync("bash", [scriptPath], { encoding: "utf8" });
  return { result, corpusPath, expected };
}

describe("pinned treebank cache", () => {
  it("accepts a cached corpus only when its digest matches", () => {
    const { result } = cachedFetch("known treebank fixture\n");
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("already present:");
  });

  it("rejects a corrupt cached corpus without deleting it", () => {
    const { result, corpusPath } = cachedFetch("corrupted treebank\n");
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("checksum mismatch");
    expect(readFileSync(corpusPath, "utf8")).toBe("corrupted treebank\n");
  });
});
