import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { RuntimeEmitBundle } from "../../../../../packages/ttsc/src/compiler/internal/build/RuntimeEmitBundle";

/**
 * Verifies a tiny runtime read retains no unrelated emit bodies and selected
 * input hashing refuses reuse inside a freshly observed native change tick.
 *
 * 1. Store a tiny module beside an unloaded 40 MiB binary output.
 * 2. Read only the module in a GC-enabled source actor and measure retention.
 * 3. Create a source after the store reference, restore its mtime, and require
 *    real content reads on both captures in that same reference epoch.
 *
 * @evidence contracts/testing.md#behavioral-verification An actual source actor measures retained heap/external memory after full GC and observes production content-read trace counts under a real post-reference ctime, catching whole-body retention and premature metadata reuse.
 * @evidence contracts/testing.md#independent-expectations Literal module bytes, a 40 MiB unrelated body and an 8 MiB retention ceiling distinguish index storage from whole-population storage; native metadata proves the required old-mtime/fresh-ctime case, and two fresh reads are the conservative expectation.
 * @evidence contracts/testing.md#distinguishing-cases A tiny loaded module contrasts a large unloaded output; a restored old modification stamp contrasts a fresh change stamp. Existing input units cover changed bytes, missing candidates and inode replacement, and bundle units cover corruption and physical fallback.
 * @evidence contracts/testing.md#execution-ownership The named unit starts one ordinary Node source actor with explicit GC and call-local trace environment; source-loader imports reach maintained owners directly without a compiler, installation or product host. Synchronous completion precedes owned temporary-root cleanup.
 */
export function test_runtime_cache_boundaries(): void {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "ttsx-resource-boundaries-"),
  );
  try {
    const emit = path.join(root, "emit");
    const trace = path.join(root, "trace");
    fs.mkdirSync(emit);
    fs.mkdirSync(trace);
    assert.equal(
      RuntimeEmitBundle.write(emit, [
        ["main.js", Buffer.from("exports.value = 7;").toString("base64")],
        ["unloaded.bin", Buffer.alloc(40 * 1024 * 1024, 97).toString("base64")],
      ]),
      true,
    );
    const result = spawnSync(
      process.execPath,
      [
        "--expose-gc",
        "--import",
        new URL(
          "../../../../../config/register-unit-loader.mjs",
          import.meta.url,
        ).href,
        fileURLToPath(
          new URL(
            "../../internal/runtime-cache-boundaries-actor.ts",
            import.meta.url,
          ),
        ),
        root,
      ],
      {
        encoding: "utf8",
        windowsHide: true,
        env: { ...process.env, NODE_OPTIONS: undefined, TTSC_E2E_TRACE: trace },
      },
    );
    assert.ifError(result.error);
    assert.equal(result.signal, null);
    assert.equal(result.status, 0, result.stdout + result.stderr);
  } finally {
    fs.rmSync(root, { recursive: true });
  }
}
