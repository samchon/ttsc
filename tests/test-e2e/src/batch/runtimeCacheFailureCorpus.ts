import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { E2eProcessTrace } from "../../../utils/src/E2eProcessTrace";
import { isOrdinarilyClosedReadonlyLauncher } from "../../../utils/src/isOrdinarilyClosedReadonlyLauncher";
import { BatchWorkspace } from "./BatchWorkspace";

/**
 * Verifies failed preparation cleans the allocated physical generation.
 *
 * The same descriptor retargets either the cache-root alias or its run-index
 * child after allocation. A same-named victim makes redirected deletion
 * visible.
 *
 * 1. Borrow the single staged project and its two initially prepared aliases.
 * 2. Run each allocation-to-descriptor-to-failure transition through installed
 *    ttsx.
 * 3. Join each launcher before checking original removal and intact victim bytes.
 *
 * @evidence contracts/testing.md#behavioral-verification Real ttsx allocation precedes the descriptor's root or child-index retarget and missing-source failure. Assertions require nonzero status, the exact missing-source diagnostic, no entry effect, an empty original index and one victim with literal bytes.
 * @evidence contracts/testing.md#independent-expectations Distinct original and victim native directories and literal victim bytes establish the deletion oracle independently of product path resolution. The allocated generation name is used only to place an adversarial same-name victim.
 * @evidence contracts/testing.md#distinguishing-cases Retargeting the cache root contrasts with retargeting its project child while the root remains unchanged. Both transitions fail after real allocation; existing Runtime success/clean cases own ordinary removal.
 * @evidence contracts/testing.md#execution-ownership The selected Runtime DAG calls this helper, whose two installed ttsx startup lifetimes execute the actual descriptor and failure assertions. Authored source is copied once and no portable unit is mislabeled as native proof.
 * @evidence contracts/e2e.md#necessary-boundary Physical cleanup authority must survive user descriptor mutation between allocation and preparation failure; direct safe-path calls cannot prove that ordering.
 * @evidence contracts/e2e.md#shared-execution Both failed startup lifetimes reuse one upfront project and installed SDK. Independent generation allocations are required for two different aliases; the missing Go source prevents unnecessary contributor builds. These are two additional launcher lifetimes, not zero execution cost.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Each alias and its original/victim targets are prepared once under the shared owned root and belong to one profile. Actual child status, signal and PID departure precede inspection; unresolved closure retains the shared graph and blocks the next profile. Remaining owned aliases and victim files are released by BatchWorkspace only after consumers join.
 * @evidence contracts/e2e.md#preserved-coverage Preserves both original runtime-root and linked-run-index failure-cleanup assertions: nonzero status, missing-source message, singleton victim bytes and original empty index. Additional native preparation cost is unmeasured and single-digit independent execution is not certified.
 */
export function runtimeCacheFailureCorpus(
  workspace: BatchWorkspace.Workspace,
): void {
  const root = path.join(workspace.root, "tools/runtime-cache-failure");
  const storage = path.join(root, "storage");
  const failures: unknown[] = [];
  let closureUnresolved = false;
  for (const mode of ["root", "index"] as const) {
    try {
      if (closureUnresolved)
        throw new Error(
          "the preceding failed-preparation actor has unresolved ownership",
        );
      const original = path.join(storage, mode + "-original");
      const victim = path.join(storage, mode + "-victim");
      const cache = path.join(storage, mode + "-cache");
      const alias = mode === "root" ? cache : path.join(cache, "project");
      const originalRuns =
        mode === "root" ? path.join(original, "project") : original;
      const victimRuns =
        mode === "root" ? path.join(victim, "project") : victim;
      assert.equal(
        fs.realpathSync.native(alias),
        fs.realpathSync.native(original),
      );
      const env: NodeJS.ProcessEnv = {
        ...process.env,
        TTSC_TEST_ORIGINAL_RUNS: originalRuns,
        TTSC_TEST_VICTIM_RUNS: victimRuns,
        TTSC_TEST_RETARGET_ALIAS: alias,
        TTSC_TEST_RETARGET_TARGET: victim,
      };
      for (const name of [
        "TTSX_RUNTIME_MANIFEST",
        "TTSX_RUNTIME_CACHE_DIR",
        "TTSX_RUNTIME_RUN_DIR",
        "TTSX_RUNTIME_RUNS_DIR",
      ])
        delete env[name];
      const result = E2eProcessTrace.spawnSync(
        process.execPath,
        [
          workspace.installedTtsx,
          "--cwd",
          root,
          "--cache-dir",
          cache,
          "src/main.ts",
        ],
        { cwd: root, env, encoding: "utf8", windowsHide: true },
      );
      if (!isOrdinarilyClosedReadonlyLauncher(result)) {
        closureUnresolved = true;
        BatchWorkspace.retain(
          "cache failure launcher closure remained unresolved",
        );
        throw new Error("cache failure launcher closure remained unresolved", {
          cause: result.error,
        });
      }
      try {
        process.kill(result.pid, 0);
        closureUnresolved = true;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ESRCH") {
          closureUnresolved = true;
          BatchWorkspace.retain(
            "cache failure PID departure could not be observed",
          );
          throw error;
        }
      }
      if (closureUnresolved) {
        BatchWorkspace.retain(
          "cache failure PID remained live after synchronous return",
        );
        throw new Error(
          "cache failure PID remained live after synchronous return",
        );
      }
      assert.equal(result.error, undefined);
      assert.equal(result.signal, null);
      assert.notEqual(result.status, 0, result.stdout);
      assert.match(result.stderr, /plugin "retarget" source does not exist/);
      assert.doesNotMatch(result.stdout, /UNREACHED CACHE FAILURE ENTRY/);
      const [generation, ...extra] = fs.readdirSync(victimRuns);
      assert.ok(generation);
      assert.deepEqual(extra, []);
      assert.equal(
        fs.readFileSync(path.join(victimRuns, generation, "keep.txt"), "utf8"),
        "victim",
      );
      assert.deepEqual(fs.readdirSync(originalRuns), []);
      assert.equal(
        fs.realpathSync.native(alias),
        fs.realpathSync.native(victim),
      );
    } catch (error) {
      failures.push(
        new Error("runtime cache " + mode + " alias failure cleanup", {
          cause: error,
        }),
      );
    }
  }
  if (failures.length)
    throw new AggregateError(
      failures,
      "runtime physical failure-cleanup corpus",
    );
}
