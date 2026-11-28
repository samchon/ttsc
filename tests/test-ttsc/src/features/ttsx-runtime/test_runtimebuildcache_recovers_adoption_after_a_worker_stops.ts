import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { RuntimeBuildCache } from "../../../../../packages/ttsc/src/compiler/internal/build/RuntimeBuildCache";
import { claimRuntimeProjectDirectory } from "../../../../../packages/ttsc/src/launcher/internal/runtime/claimRuntimeProjectDirectory";
import { systemRuntimeRunCanChange } from "../../../../../packages/ttsc/src/launcher/internal/runtime/systemRuntimeRunCanChange";
import { requestRuntimeEmit } from "../../internal/runtime-adoption-actor";

/**
 * Verifies that stopped dependency workers and system-cache launchers leave
 * their already proven build available to another run (samchon/ttsc#1922).
 *
 * @evidence contracts/testing.md#behavioral-verification Each child stops at a real rename boundary. The launcher-side cleanup parks the child's outputs before deleting its run, then a fresh request reads the original output with compilation forbidden. System entry adoption uses deferred publication and recovery through the next-run claim.
 * @evidence contracts/testing.md#independent-expectations An authored JavaScript string is the expected output and the actual child termination and stderr identify the exact boundary reached.
 * @evidence contracts/testing.md#distinguishing-cases A worker stopped before taking the build leaves it in the store. A competing move keeps the winner's bytes and the departing run's own unrelated outputs untouched. Both recovery layouts are exercised for worker and system entry adoption. A mismatched native output identity refuses replay until the original receipt is restored.
 * @evidence contracts/testing.md#execution-ownership This unit owns an external temporary tree and joins ordinary Node children before cleaning their run directories. It uses the maintained store with authored inputs and does not start a compiler.
 */
export function test_runtimebuildcache_recovers_adoption_after_a_worker_stops(): void {
  const root = fs.realpathSync.native(
    fs.mkdtempSync(path.join(os.tmpdir(), "ttsx-adoption-recovery-")),
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
      const stopped = stopAdoption(stopAt, store, abandoned);
      const unrelated = path.join(abandoned, "emit", "unrelated.js");
      if (stopAt === "lost-claim") {
        assert.ok(stopped.startsWith(store + path.sep), stopped);
        fs.mkdirSync(path.dirname(unrelated), { recursive: true });
        fs.writeFileSync(unrelated, "unrelated");
      } else assert.equal(stopped, stopAt);
      RuntimeBuildCache.parkRequested(abandoned);
      if (stopAt === "lost-claim") {
        assert.equal(fs.readFileSync(unrelated, "utf8"), "unrelated");
        const winner = path.join(directory, "winner");
        assert.equal(
          fs.readFileSync(path.join(winner, "outputs", "main.js"), "utf8"),
          "exports.value = 47;",
        );
        fs.renameSync(winner, stopped);
      }
      fs.rmSync(abandoned, { recursive: true });
      assert.equal(
        requestRuntimeEmit(store, path.join(directory, "recovery"), false),
        "exports.value = 47;",
        stopAt,
      );
    }
    for (const stopAt of ["before-take", "after-take", "after-outputs"]) {
      const system = path.join(root, "system-" + stopAt);
      const store = path.join(system, "runtime-builds");
      const seed = path.join(system, "project", "seed");
      const abandoned = path.join(system, "project", "abandoned");
      fs.mkdirSync(system, { recursive: true });
      assert.equal(
        requestRuntimeEmit(store, seed, true, system),
        "exports.value = 47;",
      );
      assert.equal(stopAdoption(stopAt, store, abandoned, system), stopAt);
      const parks = path.join(abandoned, "parks");
      const [name, ...other] = fs.readdirSync(parks);
      assert.ok(name);
      assert.deepEqual(other, []);
      if (stopAt === "after-outputs") {
        const file = path.join(parks, name);
        const receipt = fs.readFileSync(file, "utf8");
        const plan: RuntimeBuildCache.ParkRequest = JSON.parse(receipt);
        assert.ok(plan.launcherAdoption);
        fs.writeFileSync(
          file,
          JSON.stringify({
            ...plan,
            launcherAdoption: {
              ...plan.launcherAdoption,
              outputIdentity: "0:0",
            },
          }),
        );
        RuntimeBuildCache.parkRequested(abandoned, store, (directory) =>
          systemRuntimeRunCanChange(directory, system, []),
        );
        assert.equal(fs.existsSync(plan.parked), false);
        assert.ok(fs.existsSync(plan.outputs));
        fs.writeFileSync(file, receipt);
      }

      const recovery = claimRuntimeProjectDirectory(
        system,
        "recovery",
        undefined,
        (directory) => systemRuntimeRunCanChange(directory, system, []),
      );
      assert.equal(fs.existsSync(abandoned), false);
      assert.equal(
        requestRuntimeEmit(store, recovery, false, system),
        "exports.value = 47;",
        stopAt,
      );
    }
  } finally {
    fs.rmSync(root, { recursive: true });
  }
}

/** Join an interrupted cache adopter and return its named native boundary. */
function stopAdoption(
  stopAt: string,
  store: string,
  run: string,
  system?: string,
): string {
  const stopped = spawnSync(
    process.execPath,
    [
      "--import",
      new URL("../../../../../config/register-unit-loader.mjs", import.meta.url)
        .href,
      fileURLToPath(
        new URL("../../internal/runtime-adoption-actor.ts", import.meta.url),
      ),
      stopAt,
      store,
      run,
      ...(system === undefined ? [] : [system]),
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
  return stopped.stderr;
}
