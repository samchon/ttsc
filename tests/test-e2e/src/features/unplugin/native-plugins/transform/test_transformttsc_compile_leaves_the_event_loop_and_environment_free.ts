import { TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";

import { createCacheProject } from "../../../../internal/unplugin/internal/transform-project-cache/createCacheProject";
import { projectModules } from "../../../../internal/unplugin/internal/transform-project-cache/projectModules";

/**
 * Verifies a whole-project compile neither blocks the host's event loop nor
 * leaves the host's environment changed (samchon/ttsc#1391,
 * samchon/ttsc#1488).
 *
 * The compile used to run synchronously, plugin loading included, inside a
 * scope that pointed `TEMP`, `TMP`, and `TMPDIR` at the compile's scratch
 * directory. A dev server answered no other request for the whole compile. The
 * compile then moved to a worker thread, but the adapter still rewrote the
 * host's own variables around the call, because the worker adopted the host's
 * `process.env` rather than the compiler's `env`. The worker now takes the
 * compiler's `env`, which carries the scratch directory, so the host's
 * environment is never written at all; that the worker follows the compiler's
 * `env` is proven at its owner
 * (`test_ttsccompiler_source_plugin_discovery_shares_one_project`, scenario
 * `worker_scoped_environment_and_ambient_positive`). The rewrite spanned one
 * synchronous call, which no timer interrupts, so what the host observes here
 * is the environment the compile leaves behind.
 *
 * 1. Compile two private consumers sharing one immutable native producer with a
 *    known hold, sampling timers through each compile resolution.
 * 2. Assert no stall came near the hold, and `TEMP`, `TMP`, and `TMPDIR` are as
 *    the compile found them.
 *
 * @evidence contracts/testing.md#behavioral-verification Each private consumer performs one counted 1500-ms native hold and leaves sampled event-loop gaps including the final resolution gap below 750 ms and preserves TEMP/TMP/TMPDIR afterward.
 * @evidence contracts/testing.md#independent-expectations A real fixture delay and independent performance-clock samples establish responsiveness; saved environment values establish post-call equality.
 * @evidence contracts/testing.md#distinguishing-cases Cold and same-process shared-producer compilations must remain asynchronous; this observation does not prove no transient variable write between samples, which the worker-environment owner case addresses.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers this native-plugins/transform export and performs two real whole-project transforms in one process; source units cannot hide the native producer or worker boundary.
 * @evidence contracts/e2e.md#necessary-boundary The JavaScript host must remain responsive while an actual Go transform holds and the worker returns its result; the initial, intertick and terminal clock gaps independently observe the assembled async path.
 * @evidence contracts/e2e.md#shared-execution Two private consumers use fresh transform caches to require one counted native run each, while sharing immutable producer bytes and one process build cache. The second compile distinguishes warm producer metadata from a cold first compile without another installation.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Each consumer owns its source, run log and transform cache; one immutable shared producer has equivalent build inputs. Timers are cleared in finally, temporary environment snapshots are compared for both calls, and TestProject owns fixture cleanup.
 * @evidence contracts/e2e.md#preserved-coverage Both phases retain the original truthy transform, sub-750ms longest-gap and TEMP/TMP/TMPDIR equality requirements; counted run logs prevent warm cache delivery from bypassing the native hold. Sampling does not prove absence of transient environment mutation.
 */
export async function test_transformttsc_compile_leaves_the_event_loop_and_environment_free(): Promise<void> {
  const { createTtscTransformCache, resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const hold = 1_500;
  const projects = [
    createCacheProject({ fileCount: 3, transformDelayMs: hold }),
    createCacheProject({ fileCount: 3, transformDelayMs: hold }),
  ];
  const temporary = () =>
    ["TEMP", "TMP", "TMPDIR"].map((key) => [key, process.env[key]]);
  const observations = [];
  for (const [index, project] of projects.entries()) {
    const [file] = projectModules(project.root);
    const found = temporary();
    const ticks: number[] = [];
    const timer = setInterval(() => ticks.push(performance.now()), 1);
    const started = performance.now();
    let result;
    try {
      result = await transformTtsc(
        file!,
        fs.readFileSync(file!, "utf8"),
        resolveOptions(),
        undefined,
        createTtscTransformCache(),
      );
    } finally {
      clearInterval(timer);
    }
    const ended = performance.now();
    const initial = (ticks[0] ?? ended) - started;
    let intertick = 0;
    for (let tick = 1; tick < ticks.length; tick += 1)
      intertick = Math.max(intertick, ticks[tick]! - ticks[tick - 1]!);
    const final = ended - (ticks.at(-1) ?? started);
    observations.push({
      phase: index === 0 ? "cold" : "same-process shared producer",
      initial,
      intertick,
      final,
      longest: Math.max(initial, intertick, final),
      result,
      found,
      after: temporary(),
      runs: fs.readFileSync(project.runLog).byteLength,
    });
  }
  // Collect both phases before asserting, so a cold failure cannot hide reuse.
  console.log(
    "compile responsiveness",
    observations.map(({ result, found, after, ...clock }) => clock),
  );
  assert.ok(observations.every((observation) => observation.result));
  assert.deepEqual(
    observations.map((observation) => observation.runs),
    [1, 1],
    "each private consumer performs its native hold",
  );
  assert.deepEqual(
    observations.map((observation) => observation.after),
    observations.map((observation) => observation.found),
    "the compile's scratch reaches the compiler through its env, never the host's",
  );
  assert.ok(
    observations.every((observation) => observation.longest < hold / 2),
    observations
      .map(
        (observation) =>
          `${observation.phase}: initial ${observation.initial.toFixed(0)} ms, intertick ${observation.intertick.toFixed(0)} ms, final ${observation.final.toFixed(0)} ms`,
      )
      .join("; "),
  );
}
