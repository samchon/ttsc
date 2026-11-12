import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Verifies a capture reads the bytes of only the files whose own proof moved.
 *
 * One aggregate proof over the selected population was discarded by any single
 * change in it, so one edited source made every capture read and hash every
 * selected file again, in every project that reached it (samchon/ttsc#1852).
 *
 * 1. Capture three sources twice, each time under a newly opened store.
 * 2. Edit one source, add a fourth, then stop selecting one.
 * 3. Assert the hashes and the number of files each capture actually read.
 *
 * @evidence contracts/testing.md#behavioral-verification A source actor runs the production capture over real files under independently opened identity stores and reports the product's own content-read counts, so reading an unchanged file is observed as a count, not inferred from a hash.
 * @evidence contracts/testing.md#independent-expectations The authored sequence fixes the expected reads: three files never seen, none unchanged, the one edited, the one added, and none when a file merely leaves the population. Hashes are Node's SHA-256 of the authored text.
 * @evidence contracts/testing.md#distinguishing-cases First sight, full reuse, one edit among unchanged files, one addition and one removal from the selection distinguish a per-file proof from one shared by the whole population; existing units own restored stamps, absence and inode replacement.
 * @evidence contracts/testing.md#execution-ownership The named unit starts one ordinary Node source actor with a call-local trace directory; maintained owners run directly without a compiler, installation or product host, and the owned temporary root is removed after the synchronous child ends.
 */
export function test_runtimeinputcontents_reads_only_the_files_that_changed(): void {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ttsx-content-rows-"));
  try {
    const trace = path.join(root, "trace");
    const project = path.join(root, "project");
    fs.mkdirSync(trace);
    fs.mkdirSync(project);
    const result = spawnSync(
      process.execPath,
      [
        "--import",
        new URL(
          "../../../../../config/register-unit-loader.mjs",
          import.meta.url,
        ).href,
        fileURLToPath(
          new URL(
            "../../internal/runtime-input-contents-actor.ts",
            import.meta.url,
          ),
        ),
        project,
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
    assert.deepEqual(JSON.parse(result.stdout.trim().split("\n").at(-1)!), {
      reads: [3, 0, 1, 1, 0],
    });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}
