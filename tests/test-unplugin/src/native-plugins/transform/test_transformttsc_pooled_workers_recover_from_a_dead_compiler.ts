import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import type { ChildProcess } from "node:child_process";
import fs from "node:fs";

import { waitFor } from "../../internal/adapter-vite-serve/waitFor";
import { runPooledWorker } from "../../internal/pooled-session/runPooledWorker";
import { createCacheProject } from "../../internal/transform-project-cache/createCacheProject";
import { projectModules } from "../../internal/transform-project-cache/projectModules";

/**
 * Verifies a worker whose session compile died mid-compile does not block the
 * pool (samchon/ttsc#1390).
 *
 * The worker compiling a project state holds the session's lock for it, and the
 * others wait for its publication. A worker the host kills never releases that
 * lock, so the next worker must see that its holder is gone and compile
 * instead, rather than wait forever.
 *
 * 1. Start a worker whose native transform holds for seconds, wait until it holds
 *    the lock and its compile has started, and kill it.
 * 2. Assert the lock is left behind, then transform the module in another worker.
 * 3. Assert it compiles and transforms the module, and releases the lock.
 *
 * @evidence contracts/testing.md#behavioral-verification Killed lock holder leaves one lock; survivor returns PROBED at count two and removes all locks.
 * @evidence contracts/testing.md#independent-expectations SIGKILL follows observed lock plus first compile; run log proves survivor actually produces instead of only deleting lock.
 * @evidence contracts/testing.md#distinguishing-cases Interrupted in-flight producer versus new worker reclaiming abandoned lock.
 * @evidence contracts/testing.md#execution-ownership Named native-plugin E2E test_transformttsc_pooled_workers_recover_from_a_dead_compiler is selected under native-plugins/transform by @ttsc/test-unplugin src/index.ts; this body and its invoked helpers own the distinctions above.
 * @evidence contracts/e2e.md#necessary-boundary Real native producer and separate Node workers exchange session publications for interrupted in-flight producer versus new worker reclaiming abandoned lock. In-process cache calls cannot establish cross-process locks, publication transport or adoption.
 * @evidence contracts/e2e.md#shared-execution One fixture project and private session publication store are reused across this case's workers/attempts. Native artifact builds use shared cache identity; separate workers are needed for publication/adoption, and changed state or producer inputs legitimately require the compile counts above.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Private project, run log and session/store roots prevent other workers' publications from satisfying this case. Worker processes complete before assertions inspect state, except the explicitly killed producer in the recovery case. The survivor verifies abandoned lock reclamation; a failure before the explicit kill has no finally kill guard. Tracked roots are removed at process exit; cache instances used directly here have no explicit finally disposal, and abrupt cancellation is not exercised.
 * @evidence contracts/e2e.md#preserved-coverage Retained assertions: Killed lock holder leaves one lock; survivor returns PROBED at count two and removes all locks. These tags transfer no portable cases and remove no behavioral checks. Native setup and cleanup limitations above remain explicit.
 */
export async function test_transformttsc_pooled_workers_recover_from_a_dead_compiler(): Promise<void> {
  const project = createCacheProject({ fileCount: 1, transformDelayMs: 5_000 });
  const [file] = projectModules(project.root);
  const session = TestProject.tmpdir("ttsc-unplugin-pooled-dead-");
  const compiles = () =>
    fs.existsSync(project.runLog) ? fs.statSync(project.runLog).size : 0;
  const locks = () =>
    fs.readdirSync(session).filter((entry) => entry.endsWith(".lock"));

  let doomed: ChildProcess | undefined;
  const killed = runPooledWorker({
    file: file!,
    onSpawn: (child) => (doomed = child),
    session,
  });
  await waitFor(
    () => locks().length === 1 && compiles() === 1,
    "the first worker to hold the lock and start compiling",
    120_000,
  );
  doomed!.kill("SIGKILL");
  assert.equal((await killed).killed, true);
  assert.equal(locks().length, 1, "a killed holder leaves its lock behind");

  const survivor = await runPooledWorker({ file: file!, session });
  assert.equal(survivor.error, undefined, survivor.error);
  assert.match(survivor.code ?? "", /PROBED/);
  assert.equal(compiles(), 2, "the survivor compiled instead of waiting");
  assert.deepEqual(locks(), [], "the survivor released the lock");
}
