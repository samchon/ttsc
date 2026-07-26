import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Verifies the private evaluator output cap belongs to the runtime child.
 *
 * If only the outer ttsx wrapper owns `maxBuffer`, excessive config output
 * kills that wrapper and leaves its runtime child alive. The wrapper instead
 * captures and bounds the runtime streams itself, then reports the cause on the
 * private status fd.
 *
 * 1. Run a real ttsx entry that records startup and emits beyond a small cap.
 * 2. Schedule a marker that would be written if the runtime survived.
 * 3. Assert ttsx reports ENOBUFS and the child never writes the late marker.
 */
export const test_ttsx_evaluator_output_limit_terminates_the_runtime_child =
  async (): Promise<void> => {
    const root = TestProject.commonJsProject({
      "src/node.d.ts": [
        "declare const process: {",
        "  env: Record<string, string | undefined>;",
        "  exit(code: number): never;",
        "  stdout: { write(data: string): void };",
        "};",
        'declare function require(name: "node:fs"): {',
        "  writeFileSync(path: string, data: string): void;",
        "};",
        "declare function setTimeout(callback: () => void, ms: number): unknown;",
        "",
      ].join("\n"),
      "src/main.ts": [
        'const fs = require("node:fs");',
        'fs.writeFileSync(String(process.env.TTSC_TEST_READY), "ready");',
        'process.stdout.write("x".repeat(100_000));',
        "setTimeout(",
        "  () =>",
        '    fs.writeFileSync(String(process.env.TTSC_TEST_LATE), "too late"),',
        "  500,",
        ");",
        "setTimeout(() => process.exit(0), 1_000);",
        "",
      ].join("\n"),
    });
    const ready = path.join(root, "ready.txt");
    const late = path.join(root, "late.txt");

    const result = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "src/main.ts"],
      {
        cwd: root,
        env: {
          TTSC_TEST_LATE: late,
          TTSC_TEST_READY: ready,
          TTSC_TTSX_EVALUATOR_DEADLINE_MS: String(Date.now() + 10_000),
          TTSC_TTSX_EVALUATOR_MAX_BUFFER_BYTES: "1024",
          TTSC_TTSX_EVALUATOR_STATUS_FD: "3",
        },
        killSignal: "SIGKILL",
        stdio: ["ignore", "pipe", "pipe", "pipe"],
        timeout: 12_000,
      },
    );

    assert.equal(result.error, undefined, result.stderr);
    assert.equal(result.status, 1, result.stderr);
    assert.equal(result.output?.[3]?.trim(), "ENOBUFS");
    assert.equal(fs.existsSync(ready), true, "runtime child never started");

    await new Promise((resolve) => setTimeout(resolve, 750));
    assert.equal(
      fs.existsSync(late),
      false,
      "runtime child survived its evaluator output limit",
    );
  };
