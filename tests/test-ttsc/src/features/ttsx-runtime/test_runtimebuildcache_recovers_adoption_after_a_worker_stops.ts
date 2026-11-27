import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { RuntimeBuildCache } from "../../../../../packages/ttsc/src/compiler/internal/build/RuntimeBuildCache";
import { requestRuntimeEmit } from "../../internal/runtime-adoption-actor";

/**
 * Verifies that a stopped dependency worker leaves its already proven build
 * available to another run (samchon/ttsc#1922).
 *
 * @evidence contracts/testing.md#behavioral-verification Each child stops at a real rename boundary. The launcher-side cleanup parks the child's outputs before deleting its run, then a fresh request reads the original output with compilation forbidden.
 * @evidence contracts/testing.md#independent-expectations An authored JavaScript string is the expected output and the actual child termination and stderr identify the exact boundary reached.
 * @evidence contracts/testing.md#distinguishing-cases A worker stopped before taking the build leaves it in the store. A competing move keeps the winner's bytes and the departing run's own unrelated outputs untouched. Stopping after taking the directory or moving its outputs exercises both recovery layouts.
 * @evidence contracts/testing.md#execution-ownership This unit owns an external temporary tree and joins ordinary Node children before cleaning their run directories. It uses the maintained store with authored inputs and does not start a compiler.
 */
export function test_runtimebuildcache_recovers_adoption_after_a_worker_stops(): void {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "ttsx-adoption-recovery-"),
  );
  try {
    for (const stopAt of [
      "before-take",
      "lost-claim",
      "after-take",
      "after-outputs",
    ]) {
      const directory = path.join(root, stopAt);
      const store = path.join(directory, "store");
      const seed = path.join(directory, "seed");
      const abandoned = path.join(directory, "abandoned");
      assert.equal(
        requestRuntimeEmit(store, seed, true),
        "exports.value = 47;",
      );
      RuntimeBuildCache.parkRequested(seed);
      const stopped = spawnSync(
        process.execPath,
        [
          "--import",
          new URL(
            "../../../../../config/register-unit-loader.mjs",
            import.meta.url,
          ).href,
          fileURLToPath(
            new URL(
              "../../internal/runtime-adoption-actor.ts",
              import.meta.url,
            ),
          ),
          stopAt,
          store,
          abandoned,
        ],
        {
          encoding: "utf8",
          windowsHide: true,
          env: { ...process.env, NODE_OPTIONS: undefined },
        },
      );
      assert.ifError(stopped.error);
      if (process.platform === "win32") assert.equal(stopped.status, 1);
      else assert.equal(stopped.signal, "SIGKILL");
      const unrelated = path.join(abandoned, "emit", "unrelated.js");
      if (stopAt === "lost-claim") {
        assert.ok(stopped.stderr.startsWith(store + path.sep), stopped.stderr);
        fs.mkdirSync(path.dirname(unrelated), { recursive: true });
        fs.writeFileSync(unrelated, "unrelated");
      } else assert.equal(stopped.stderr, stopAt);
      RuntimeBuildCache.parkRequested(abandoned);
      if (stopAt === "lost-claim") {
        assert.equal(fs.readFileSync(unrelated, "utf8"), "unrelated");
        const winner = path.join(directory, "winner");
        assert.equal(
          fs.readFileSync(path.join(winner, "outputs", "main.js"), "utf8"),
          "exports.value = 47;",
        );
        fs.renameSync(winner, stopped.stderr);
      }
      fs.rmSync(abandoned, { recursive: true });
      assert.equal(
        requestRuntimeEmit(store, path.join(directory, "recovery"), false),
        "exports.value = 47;",
        stopAt,
      );
    }
  } finally {
    fs.rmSync(root, { recursive: true });
  }
}
