import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { createBareProject } from "../../internal/metro-cache";
import { TestMetroRuntime } from "../../internal/metro-runtime";

/**
 * Verifies snapshot preparation preserves live ownership and retires a dead
 * owner before a later preparation merges the pending worker.
 *
 * A live compactor owns the main snapshot and worker documents. Discovering a
 * dead owner retires only its lock; that discovery run still takes a private
 * token, leaving the next preparation to publish the worker observation.
 *
 * 1. Prepare a bare project and write one version-four worker document.
 * 2. Hold the lock with this process's PID and assert a private token without
 *    changing the epoch or pending worker.
 * 3. Replace the owner with an actually exited Node PID, verify retirement and
 *    retained work, then prepare again and verify the unchanged epoch and merge.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls source fingerprint.prepareSnapshot directly over a real temporary directory. Live ownership produces nonce: plus 32 hex digits without rewriting the main epoch or removing the worker. A proven-dead owner produces the same token grammar, retires the fixed lock to its token-named quarantine and retains the worker; a later preparation keeps the epoch, includes the recorded path and removes every worker document.
 * @evidence contracts/testing.md#independent-expectations The current PID and an owned Node child that exited with status zero and no signal establish native ownership inputs independently of prepareSnapshot. Only ESRCH from a separate signal-zero query establishes the departed PID is absent; success, EPERM and every other error fail that premise. Literal version-four document fields, owner tokens, nonce grammar and the recorded path establish the expected state transitions. Epoch equality checks preservation, not the implementation's epoch-generation algorithm.
 * @evidence contracts/testing.md#distinguishing-cases Live ownership contrasts proven-dead ownership and the subsequent successful merge. The dead-owner discovery itself must not consume the worker. PID reuse or an inconclusive native query fails preparation of this case rather than being treated as death or skipped. Malformed owner records, competing reapers and real concurrent 150-round compaction are not exercised here.
 * @evidence contracts/testing.md#execution-ownership Source unit discovered as this exported test under src/features/cache. It invokes the authored fingerprint operation in-process through TestMetroRuntime; a trivial synchronous Node child supplies only the native PID input and does not run Metro, a compactor protocol, an installed consumer or a compiler. The owned temporary root is removed in finally. This case does not replace the shipped-package or concurrent-process E2E boundaries.
 */
export const test_prepare_snapshot_preserves_live_ownership_and_retires_a_dead_owner =
  async () => {
    const root = createBareProject();
    try {
      const fingerprint = await TestMetroRuntime.loadFingerprint();
      const directory = path.join(root, "node_modules", ".cache", "ttsc-metro");
      const mainFile = path.join(directory, "graph-inputs.json");
      const workerName = "graph-inputs.worker-test.json";
      const lock = path.join(directory, "snapshot-compaction.lock");
      fingerprint.prepareSnapshot(root);
      const identity = JSON.parse(fs.readFileSync(mainFile, "utf8")).id;
      assert.match(identity, /^[a-f0-9]{32}$/);
      const recorded = path.join(root, "..", "somewhere", "external.d.ts");
      fs.writeFileSync(
        path.join(directory, workerName),
        JSON.stringify({
          files: [recorded],
          tainted: false,
          trees: [],
          accessibleEntries: [],
          version: 4,
          volatile: false,
        }),
        "utf8",
      );
      const workers = () =>
        fs
          .readdirSync(directory)
          .filter(
            (name) =>
              name.startsWith("graph-inputs.worker-") && name.endsWith(".json"),
          );

      assert.doesNotThrow(() => process.kill(process.pid, 0));
      fs.mkdirSync(lock);
      fs.writeFileSync(
        path.join(lock, "owner.json"),
        JSON.stringify({ pid: process.pid, token: "1".repeat(32) }),
        "utf8",
      );
      try {
        assert.match(fingerprint.prepareSnapshot(root), /^nonce:[a-f0-9]{32}$/);
        assert.equal(JSON.parse(fs.readFileSync(mainFile, "utf8")).id, identity);
        assert.deepEqual(workers(), [workerName]);
        assert.deepEqual(
          JSON.parse(fs.readFileSync(path.join(lock, "owner.json"), "utf8")),
          { pid: process.pid, token: "1".repeat(32) },
        );
      } finally {
        fs.rmSync(lock, { force: true, recursive: true });
      }

      const exited = spawnSync(process.execPath, ["-e", ""], {
        stdio: "ignore",
        timeout: 10_000,
      });
      assert.equal(exited.error, undefined);
      assert.equal(exited.status, 0);
      assert.equal(exited.signal, null);
      assert.ok(Number.isSafeInteger(exited.pid) && exited.pid > 0);
      assert.throws(
        () => process.kill(exited.pid, 0),
        (error: unknown) =>
          error instanceof Error &&
          (error as NodeJS.ErrnoException).code === "ESRCH",
        "only a definitely absent native PID may be used as a dead owner",
      );
      const staleToken = "2".repeat(32);
      fs.mkdirSync(lock);
      fs.writeFileSync(
        path.join(lock, "owner.json"),
        JSON.stringify({ pid: exited.pid, token: staleToken }),
        "utf8",
      );
      assert.match(fingerprint.prepareSnapshot(root), /^nonce:[a-f0-9]{32}$/);
      assert.equal(fs.existsSync(lock), false);
      assert.equal(
        fs.existsSync(
          path.join(directory, `.snapshot-compaction-stale-${staleToken}`),
        ),
        true,
      );
      assert.equal(JSON.parse(fs.readFileSync(mainFile, "utf8")).id, identity);
      assert.deepEqual(workers(), [workerName]);

      assert.match(fingerprint.prepareSnapshot(root), /^[a-f0-9]{32}$/);
      const main = JSON.parse(fs.readFileSync(mainFile, "utf8"));
      assert.equal(main.id, identity);
      assert.deepEqual(main.files, [recorded]);
      assert.deepEqual(workers(), []);
    } finally {
      fs.rmSync(root, { force: true, recursive: true });
    }
  };
