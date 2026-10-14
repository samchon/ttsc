import {
  TestProject,
  TestUnpluginProject,
  TestUnpluginRuntime,
} from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { setImmediate } from "node:timers/promises";

import type { TtscCachedProjectTransform } from "../../../../../../packages/unplugin/src/core/transform/cache/TtscCachedProjectTransform";
import type { TtscTransformCache } from "../../../../../../packages/unplugin/src/core/transform/cache/TtscTransformCache";
import { waitFor } from "../../../../../utils/src/internal/waitFor";

/**
 * Verifies explicit project preparation overlaps native compiles without delivery effects.
 *
 * A host discovers imports serially, but selected projects can prepare together. Preparation must leave first-delivery authority and host registration for the actual load, and teardown must not let a pending preparation restore the cache.
 *
 * 1. Hold two native compiles and observe both barriers before releasing either.
 * 2. Deliver one project, then distinguish the other's preparation from its first
 *    load.
 * 3. Keep one native release input malformed through preparation and actual load, then repair it.
 * 4. Reset with preparation pending, release it, and verify detached ownership.
 *
 * @evidence contracts/testing.md#behavioral-verification The built transform API starts two actual native gates before either is released, shares a duplicate selected entry, and retains no preparation-only watch, project, volatility, served-file or diagnostic handoff. A failed speculative project cannot fail the other load; its actual request fails and changed source recovers. Reset during held preparation leaves the cache empty after settlement and detaches native tracker owners.
 * @evidence contracts/testing.md#independent-expectations Two distinct authored projects require two in-flight cache entries and two native barriers; the existing fixture appends one byte per compile and uppercases literal alpha/beta/repaired inputs. Callback counts and generation metadata are observed separately from native output, without a wall-clock speed oracle.
 * @evidence contracts/testing.md#distinguishing-cases Distinct projects overlap despite the current host delivery's fixed project selection, a duplicate explicit entry shares its project, preparation differs from actual delivery, an unrelated successful project survives a persistently malformed native release input, protocol and source repair recover, and pending reset differs from an ordinary retained generation. Existing transform units own wrapper and option parsing distinctions.
 * @evidence contracts/testing.md#execution-ownership The scenarios batch imports this case, which invokes the built public API and real native protocol fixture; portable scheduler units do not establish native overlap or adapter admission.
 * @evidence contracts/e2e.md#necessary-boundary Actual native processes publish gates through the supplied descriptors and return envelopes to the built transform cache. A callback-only scheduler unit cannot establish this compiler connection, proof reuse, failure delivery or pending native resource transfer.
 * @evidence contracts/e2e.md#shared-execution Two necessary project roots share TestUnpluginProject's immutable native producer and content-addressed build cache. Three lifecycle states reuse those roots, descriptors and one transform cache; only source changes or explicit reset authorize fresh compiles.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Native gate files and run logs live outside both project input trees. Every started cache promise and actual delivery is joined after releasing gates, then reset transfers retained generations to cleanup before roots are removed. Failed release withdraws its barrier so the native wait returns an error. Tracker-field detachment establishes ownership release, not a certificate that every native close succeeded.
 * @evidence contracts/e2e.md#preserved-coverage This new case adds explicit startup overlap, deferred handoff, failed preparation recovery and pending reset coverage without removing existing scenarios or their compiler and watcher distinctions.
 */
export async function case_explicit_precompilation_overlaps_project_gates(): Promise<void> {
  const api = await TestUnpluginRuntime.loadUnpluginApi();
  const parent = TestProject.tmpdir("ttsc-precompile-gates-");
  const control = path.join(parent, "control");
  fs.mkdirSync(control);
  const fixtures = path.resolve(
    import.meta.dirname,
    "../../../../fixtures/unplugin/precompile",
  );
  const projects = ["alpha", "beta"].map((value) => {
    const barrier = path.join(control, value + ".barrier");
    const release = path.join(control, value + ".release");
    const runLog = path.join(control, value + ".runs");
    const root = TestUnpluginProject.createProject({
      temporaryParent: parent,
      source: fs.readFileSync(path.join(fixtures, value + ".ts"), "utf8"),
      plugins: [
        {
          transform: "./plugin.cjs",
          name: "runs",
          operation: "count-runs",
          runLog,
        },
        {
          transform: "./plugin.cjs",
          name: "hold",
          operation: "await-release",
          barrier,
          release,
        },
        {
          transform: "./plugin.cjs",
          name: "uppercase",
          operation: "go-uppercase",
        },
      ],
    });
    return {
      root,
      file: TestUnpluginProject.mainFile(root),
      barrier,
      release,
      runLog,
    };
  });
  const [alpha, beta] = projects;
  assert.ok(alpha && beta);
  const cache: TtscTransformCache = api.createTtscTransformCache();
  const options = api.resolveOptions({
    precompile: [alpha.file, beta.file, beta.file],
  });
  const effects = { watch: 0, project: 0, volatile: 0 };
  const hooks = {
    exactPath: true,
    addWatchFiles: () => {
      effects.watch += 1;
    },
    markVolatile: () => {
      effects.volatile += 1;
    },
    project: {
      toolDirectory: path.join(control, "records"),
      register: () => {
        effects.project += 1;
      },
    },
  };
  const joins = new Set<Promise<unknown>>();
  const track = <T>(promise: Promise<T>): Promise<T> => {
    joins.add(promise);
    void promise.catch(() => undefined);
    return promise;
  };
  const deliver = (project: (typeof projects)[number]) =>
    track(
      api.transformTtsc(
        project.file,
        fs.readFileSync(project.file, "utf8"),
        options,
        undefined,
        cache,
        {
          ...hooks,
          projectSelection: path.join(project.root, "tsconfig.json"),
        },
      ) as Promise<{ code: string } | undefined>,
    );
  const runs = (project: (typeof projects)[number]) =>
    fs.existsSync(project.runLog) ? fs.statSync(project.runLog).size : 0;
  const prepareGates = () => {
    for (const project of projects) {
      fs.rmSync(project.barrier, { force: true });
      fs.rmSync(project.release, { force: true });
      fs.rmSync(project.runLog, { force: true });
    }
  };
  const start = () => {
    const first = deliver(alpha);
    assert.equal(
      cache.size,
      2,
      "both selected project captures start before host traversal continues",
    );
    const pending = [...cache.values()];
    for (const promise of pending) track(promise);
    return { first, pending };
  };
  const held = async (
    pending: readonly Promise<TtscCachedProjectTransform>[],
  ) => {
    let settled = false;
    let early: unknown;
    for (const promise of pending)
      void promise.then(
        (value) => {
          settled = true;
          early = value.result;
        },
        (error) => {
          settled = true;
          early = error;
        },
      );
    await waitFor(
      () => projects.every((project) => fs.existsSync(project.barrier)),
      "both native project compiles to publish their held gates",
      {
        check: () => {
          if (settled)
            throw new Error("native compiles must remain held until release", {
              cause: early,
            });
        },
      },
    );
    assert.deepEqual(
      projects.map(runs),
      [1, 1],
      "duplicate explicit entries share one native project compile",
    );
  };
  const release = (project: (typeof projects)[number]) => {
    if (
      fs.existsSync(project.release) &&
      fs.lstatSync(project.release).isDirectory()
    )
      fs.rmdirSync(project.release);
    fs.writeFileSync(project.release, "");
  };
  const failures: unknown[] = [];
  try {
    prepareGates();
    const initial = start();
    await held(initial.pending);
    assert.deepEqual(effects, { watch: 0, project: 0, volatile: 0 });
    release(alpha);
    assert.match((await initial.first)!.code, /"ALPHA"/);
    assert.deepEqual(effects, { watch: 1, project: 1, volatile: 0 });
    release(beta);
    const prepared = await Promise.all(initial.pending);
    const betaRoot = fs.realpathSync.native(beta.root);
    const betaGeneration = prepared.find(
      (generation) =>
        fs.realpathSync.native(generation.projectRoot) === betaRoot,
    )!;
    assert.ok(betaGeneration);
    assert.equal(betaGeneration.servedFiles?.size ?? 0, 0);
    assert.notEqual(betaGeneration.diagnosticsReported, true);
    assert.equal(betaGeneration.divergentDeliveryReported?.size ?? 0, 0);
    assert.deepEqual(effects, { watch: 1, project: 1, volatile: 0 });
    assert.match((await deliver(beta))!.code, /"BETA"/);
    assert.deepEqual(effects, { watch: 2, project: 2, volatile: 0 });
    assert.equal(betaGeneration.servedFiles?.size, 1);
    assert.deepEqual(projects.map(runs), [1, 1]);

    api.resetTtscTransformCache(cache);
    await setImmediate();
    prepareGates();
    const failed = start();
    await held(failed.pending);
    release(alpha);
    assert.match((await failed.first)!.code, /"ALPHA"/);
    // The protocol requires a regular release file. Keep that input invalid
    // through the actual request, which may legitimately retry preparation.
    fs.mkdirSync(beta.release);
    await Promise.allSettled(failed.pending);
    assert.deepEqual(
      effects,
      { watch: 3, project: 3, volatile: 0 },
      "failed preparation has no host handoff",
    );
    await assert.rejects(deliver(beta), /requires a regular release file/);
    fs.copyFileSync(path.join(fixtures, "repaired.ts"), beta.file);
    release(beta);
    assert.match((await deliver(beta))!.code, /"REPAIRED"/);

    api.resetTtscTransformCache(cache);
    await setImmediate();
    prepareGates();
    const withdrawn = start();
    await held(withdrawn.pending);
    release(alpha);
    assert.match((await withdrawn.first)!.code, /"ALPHA"/);
    const beforeWithdrawal = { ...effects };
    api.resetTtscTransformCache(cache);
    assert.equal(cache.size, 0);
    release(beta);
    const retired = await Promise.all(withdrawn.pending);
    await setImmediate();
    assert.equal(
      cache.size,
      0,
      "pending preparation cannot resurrect a withdrawn generation",
    );
    assert.deepEqual(effects, beforeWithdrawal);
    for (const generation of retired) {
      assert.equal(generation.result.type, "success");
      assert.equal(generation.projectMutationTracker, undefined);
      assert.equal(generation.hostInputMutationTracker, undefined);
      assert.equal(generation.candidateMutationTracker, undefined);
    }
  } catch (error) {
    failures.push(error);
  } finally {
    for (const project of projects) {
      try {
        release(project);
      } catch (error) {
        failures.push(error);
        try {
          fs.rmSync(project.barrier, { force: true });
        } catch (withdrawal) {
          failures.push(withdrawal);
        }
      }
    }
    await Promise.allSettled([...joins]);
    try {
      api.resetTtscTransformCache(cache);
      await setImmediate();
    } catch (error) {
      failures.push(error);
    }
    try {
      fs.rmSync(parent, {
        recursive: true,
        force: true,
        maxRetries: 3,
        retryDelay: 100,
      });
    } catch (error) {
      failures.push(error);
    }
  }
  if (failures.length)
    throw new AggregateError(failures, "explicit precompilation native gates");
}
