import { afterEach, describe, expect, it } from "vitest";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const REPO_ROOT = path.resolve(__dirname, "..");
const SCRIPT_ROOT = path.join(REPO_ROOT, "scripts");
const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

function sandbox(prefix: string): { root: string; bin: string } {
  const root = mkdtempSync(path.join(tmpdir(), prefix));
  const bin = path.join(root, "bin");
  roots.push(root);
  mkdirSync(bin);
  return { root, bin };
}

function makeExecutable(file: string, contents: string): void {
  writeFileSync(file, contents);
  chmodSync(file, 0o755);
}

function runFailingTestNames(
  report: Record<string, unknown>,
  reportExit = 1,
  runOutput = "",
) {
  const { root, bin } = sandbox("yaae-failing-test-names-");
  makeExecutable(
    path.join(bin, "pnpm"),
    `#!/usr/bin/env node
const fs = require("node:fs");
const output = process.argv.find((arg) => arg.startsWith("--outputFile="));
if (!output) process.exit(91);
fs.writeFileSync(output.slice("--outputFile=".length), ${JSON.stringify(JSON.stringify(report))});
if (${JSON.stringify(runOutput)} !== "") process.stderr.write(${JSON.stringify(runOutput)});
process.exit(${reportExit});
`,
  );
  return spawnSync("bash", [path.join(SCRIPT_ROOT, "failing-test-names.sh")], {
    cwd: REPO_ROOT,
    env: {
      ...process.env,
      PATH: `${bin}:${process.env.PATH ?? ""}`,
    },
    encoding: "utf8",
  });
}

function runStartupMeasurement(mode: "success" | "fail-one" | "numeric-failure") {
  const { root, bin } = sandbox("yaae-startup-measurement-");
  const state = path.join(root, "node-calls");
  makeExecutable(
    path.join(bin, "node"),
    `#!/usr/bin/env bash
if [ "\${1:-}" = "--version" ]; then
  printf 'vfake\\n'
  exit 0
fi
call=0
if [ -f "\${FAKE_NODE_STATE}" ]; then
  read -r call < "\${FAKE_NODE_STATE}"
fi
call=$((call + 1))
printf '%s\\n' "\${call}" > "\${FAKE_NODE_STATE}"
if [ "\${FAKE_NODE_MODE}" = "fail-one" ] && [ "\${call}" -eq 3 ]; then
  exit 1
fi
if [ "\${FAKE_NODE_MODE}" = "numeric-failure" ] && [ "\${call}" -eq 3 ]; then
  printf '1\\n'
  exit 1
fi
printf '1\\n'
`,
  );
  return spawnSync(
    "bash",
    [path.join(SCRIPT_ROOT, "measure-tagger-startup.sh"), "2"],
    {
      cwd: REPO_ROOT,
      env: {
        ...process.env,
        FAKE_NODE_MODE: mode,
        FAKE_NODE_STATE: state,
        PATH: `${bin}:${process.env.PATH ?? ""}`,
      },
      encoding: "utf8",
    },
  );
}

describe("failing-test-names.sh", () => {
  it("rejects a failed runner even when its partial report contains passing assertions", () => {
    const result = runFailingTestNames({
      testResults: [{ name: "/repo/tests/passing.test.ts", status: "passed",
        assertionResults: [{ status: "passed", fullName: "suite passes" }] }],
    }, 1, "unhandled runner failure");
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("unhandled runner failure");
  });

  it("rejects an empty report after a failed vitest run", () => {
    const result = runFailingTestNames({
      numTotalTestSuites: 0,
      numTotalTests: 0,
      testResults: [],
    }, 1, "vitest collection detail\\n");

    expect(result.status).toBe(2);
    expect(result.stderr).toContain("no collected test suites or assertions");
    expect(result.stderr).toContain("vitest collection detail");
  });

  it("rejects a collection or runtime failure with no assertions", () => {
    const result = runFailingTestNames({
      numTotalTestSuites: 1,
      numTotalTests: 0,
      testResults: [
        {
          name: "/repo/tests/broken.test.ts",
          status: "failed",
          assertionResults: [],
          message: "failed to collect test file",
        },
      ],
    });

    expect(result.status).toBe(2);
    expect(result.stderr).toContain("collection/runtime failure");
  });

  it("still lists ordinary assertion failures as a usable result", () => {
    const result = runFailingTestNames({
      numTotalTestSuites: 1,
      numTotalTests: 1,
      testResults: [
        {
          name: "/repo/tests/failing.test.ts",
          status: "failed",
          assertionResults: [
            {
              status: "failed",
              fullName: "suite fails",
              title: "fails",
            },
          ],
        },
      ],
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("tests/failing.test.ts > suite fails");
    expect(result.stderr).toBe("");
  });
});

describe("measure-tagger-startup.sh", () => {
  it("returns success when every requested sample produces a number", () => {
    const result = runStartupMeasurement("success");

    expect(result.status).toBe(0);
    expect(result.stdout).not.toContain("WARNING");
  });

  it("returns exit 2 when any requested sample fails", () => {
    const result = runStartupMeasurement("fail-one");

    expect(result.status).toBe(2);
    expect(result.stdout).toContain("WARNING: 1 of 2 runs failed");
    expect(result.stderr).toContain("incomplete measurement");
  });

  it("rejects a numeric sample when its runner exits nonzero", () => {
    const result = runStartupMeasurement("numeric-failure");

    expect(result.status).toBe(2);
    expect(result.stdout).toContain("WARNING: 1 of 2 runs failed");
    expect(result.stderr).toContain("incomplete measurement");
  });
});
