import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import type { ChildProcess } from "node:child_process";
import fs from "node:fs";

import { waitFor } from "../../../../../../utils/src/internal/waitFor";
import { runPooledWorker } from "../../../../internal/unplugin/internal/pooled-session/runPooledWorker";
import { createCacheProject } from "../../../../internal/unplugin/internal/transform-project-cache/createCacheProject";
import { projectModules } from "../../../../internal/unplugin/internal/transform-project-cache/projectModules";

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
 * @evidence contracts/testing.md#execution-ownership The ordinary tests/test-e2e/src/index.ts run selects nine batch entries whose import graph excludes this retained module, so that suite does not execute this declaration. If explicitly invoked, test_transformttsc_pooled_workers_recover_from_a_dead_compiler owns the killed Node lock holder, surviving worker delivery and abandoned-lock reclamation. Evidence selection does not establish runtime coverage.
 * @evidence contracts/e2e.md#necessary-boundary Real native producer and separate Node workers exchange session publications for interrupted in-flight producer versus new worker reclaiming abandoned lock. In-process cache calls cannot establish cross-process locks, publication transport or adoption.
 * @evidence contracts/e2e.md#shared-execution One fixture project and private session publication store are reused across this case's workers/attempts. Native artifact builds use shared cache identity; separate workers are needed for publication/adoption, and changed state or producer inputs legitimately require the compile counts above.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Private project, run log and session/store roots prevent other workers' publications from satisfying this case. Each original Node close is observed independently of its result Promise, including a startup error. A failure attempts both owned worker closures concurrently, preserves body and cleanup causes, and cannot authorize reuse before their actual closes. The survivor verifies abandoned lock reclamation; tracked roots remain process-owned and outer contained cancellation owns unresolved native descendants.
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

  const actors: { child: ChildProcess; closed: Promise<void>; joined: boolean }[] = [];
  const own = (child: ChildProcess) => {
    let close!: () => void;
    const actor = { child, closed: new Promise<void>((resolve) => { close = resolve; }), joined: false };
    child.once("close", () => { actor.joined = true; close(); });
    actors.push(actor);
  };
  const killed = runPooledWorker({ file: file!, onSpawn: own, session });
  let completed = false;
  let producerResult: unknown;
  const returned = killed.then(
    (value) => { completed = true; producerResult = value; return value; },
    (error) => { completed = true; producerResult = error; throw error; },
  );
  void returned.catch(() => undefined);
  const errors: unknown[] = [];
  try {
    await waitFor(() => {
      if (completed || actors[0]!.joined)
        throw new Error("holder completed before its live claim", { cause: producerResult });
      return locks().length === 1 && compiles() === 1;
    }, "the first worker to hold the lock and start compiling");
    assert.equal(actors[0]!.child.kill("SIGKILL"), true);
    const interrupted = await returned;
    await actors[0]!.closed;
    assert.equal(interrupted.killed, true);
    assert.equal(locks().length, 1, "a killed holder leaves its lock behind");

    const survivor = await runPooledWorker({ file: file!, onSpawn: own, session });
    await actors[1]!.closed;
    assert.equal(survivor.error, undefined, survivor.error);
    assert.match(survivor.code ?? "", /PROBED/);
    assert.equal(compiles(), 2, "the survivor compiled instead of waiting");
    assert.deepEqual(locks(), [], "the survivor released the lock");
  } catch (error) {
    errors.push(error);
  } finally {
    const closes = await Promise.allSettled(actors.map(async (actor) => {
      if (!actor.joined) actor.child.kill("SIGKILL");
      await actor.closed;
    }));
    for (const close of closes) if (close.status === "rejected") errors.push(close.reason);
  }
  if (errors.length) throw new AggregateError(errors, "pooled producer and original worker closure");
}
