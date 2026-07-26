import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { PLUGIN_DESCRIPTOR_MAX_BUFFER_BYTES } from "../../../../../packages/ttsc/lib/plugin/internal/descriptorProcessFailure.js";

/**
 * Verifies the private evaluator deadline reaches ttsx's runtime child.
 *
 * The lint and descriptor loaders spawn the ttsx wrapper, but user setup runs
 * in the second Node process created by `runPreparedEntry`. Killing only the
 * wrapper leaves that evaluator alive on POSIX.
 *
 * 1. Run a real ttsx entry that records startup and schedules a later marker.
 * 2. Give the runtime child an absolute deadline before that later marker.
 * 3. Assert ttsx reports the private timeout and the child never reaches it.
 */
export const test_ttsx_evaluator_deadline_terminates_the_runtime_child =
  async (): Promise<void> => {
    const root = TestProject.commonJsProject({
      "src/node.d.ts": [
        "declare const process: {",
        "  env: Record<string, string | undefined>;",
        "  exit(code: number): never;",
        '  on(signal: "SIGTERM", listener: () => void): void;',
        "};",
        'declare function require(name: "node:fs"): {',
        "  writeFileSync(path: string, data: string): void;",
        "};",
        "declare function setTimeout(callback: () => void, ms: number): unknown;",
        "",
      ].join("\n"),
      "src/main.ts": [
        'const fs = require("node:fs");',
        'process.on("SIGTERM", () => {});',
        'fs.writeFileSync(String(process.env.TTSC_TEST_READY), "ready");',
        "setTimeout(",
        "  () =>",
        '    fs.writeFileSync(String(process.env.TTSC_TEST_LATE), "too late"),',
        "  Math.max(0, Number(process.env.TTSC_TEST_LATE_AT_MS) - Date.now()),",
        ");",
        "setTimeout(",
        "  () => process.exit(0),",
        "  Math.max(0, Number(process.env.TTSC_TEST_EXIT_AT_MS) - Date.now()),",
        ");",
        "",
      ].join("\n"),
    });
    const ready = path.join(root, "ready.txt");
    const late = path.join(root, "late.txt");
    const deadlineMs = Date.now() + 6_000;
    const lateAtMs = deadlineMs + 750;
    const exitAtMs = deadlineMs + 2_000;

    const result = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "src/main.ts"],
      {
        cwd: root,
        env: {
          TTSC_TEST_EXIT_AT_MS: String(exitAtMs),
          TTSC_TEST_LATE: late,
          TTSC_TEST_LATE_AT_MS: String(lateAtMs),
          TTSC_TEST_READY: ready,
          TTSC_TTSX_EVALUATOR_DEADLINE_MS: String(deadlineMs),
          TTSC_TTSX_EVALUATOR_MAX_BUFFER_BYTES: String(
            PLUGIN_DESCRIPTOR_MAX_BUFFER_BYTES,
          ),
          TTSC_TTSX_EVALUATOR_STATUS_FD: "3",
        },
        killSignal: "SIGKILL",
        stdio: ["ignore", "pipe", "pipe", "pipe"],
        timeout: 12_000,
      },
    );

    assert.equal(result.error, undefined, result.stderr);
    assert.equal(result.status, 1, result.stderr);
    assert.equal(result.output?.[3]?.trim(), "ETIMEDOUT");
    assert.equal(fs.existsSync(ready), true, "runtime child never started");

    await new Promise((resolve) =>
      setTimeout(resolve, Math.max(0, lateAtMs + 500 - Date.now())),
    );
    assert.equal(
      fs.existsSync(late),
      false,
      "runtime child survived its evaluator deadline",
    );
  };
