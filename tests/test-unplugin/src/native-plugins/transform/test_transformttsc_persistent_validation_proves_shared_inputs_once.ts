import { TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { createCacheProject } from "../../internal/transform-project-cache/createCacheProject";
import { projectModules } from "../../internal/transform-project-cache/projectModules";

/**
 * Verifies a generation proves each shared input once instead of once per
 * delivered module, without loosening invalidation.
 *
 * `test_transformttsc_persistent_validation_uses_per_file_inputs` gives every
 * module a disjoint external input, which hides this cost: a real program gives
 * every module the same reachable closure and the same `graph.globals`, so
 * re-reading each delivery's inputs multiplies one generation's proven bytes by
 * the module count. The bound is met only when an unchanged metadata signature
 * stands in for the content comparison, and when one file's two spellings each
 * keep their own proof.
 *
 * 1. Deliver eight modules sharing 24 externals and 24 globals, one of them
 *    aliased, and assert the read count stays within the bound.
 * 2. Make a metadata-only change and assert it is proven once, not reread per
 *    delivery, and keeps the generation.
 * 3. Edit a global, a reachable external, and project membership, and assert each
 *    replaces the generation.
 *
 * @evidence contracts/testing.md#behavioral-verification Eight modules sharing 24 externals/globals perform zero steady reads, reprove touched content at most once, then invalidate for global/external/membership/sibling-source edits.
 * @evidence contracts/testing.md#independent-expectations Independent cache-local byte counters and run log measure work; deliberate metadata-only and content mutations set distinct freshness expectations.
 * @evidence contracts/testing.md#distinguishing-cases Shared closure and POSIX aliased spelling must each retain proof; unchanged touch reuses while four real input changes replace generation.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers test_transformttsc_persistent_validation_proves_shared_inputs_once in native-plugins/transform in the E2E population. Its local callbacks and helper-driven module matrix execute under this named entry; embedded native operations are fixture inputs, not separately selectable test hosts.
 * @evidence contracts/e2e.md#necessary-boundary The built transform API must hand an actual native fixture envelope to generation capture/validation and then serve the selected modules. The native run log and reported graph/proofs expose that connection; synthetic graph options test envelope transport and admission, not correctness of TypeScript-Go graph construction.
 * @evidence contracts/e2e.md#shared-execution createCacheProject reuses the materialized cache Go fixture and content-addressed build cache unless this case requests isolatedPluginSource; unique consumer and run-log roots keep mutable inputs private. Within each consumer/cache scenario, repeated deliveries reuse that scenario's transform cache; distinct consumers or policies keep separate caches. Changed declared inputs or rejected capture require the counted new invocation.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Consumer, source edits, hook counters and transform cache belong to this case; shared producer inputs remain equivalent or their changed content selects a new build key. TestProject owns its managed temporary roots through runner cleanup. This case does not explicitly reset every retained transform cache; generation disposal and runner termination bound native observer lifetime, rather than a claimed per-case cleanup.
 * @evidence contracts/e2e.md#preserved-coverage Eight modules sharing 24 externals/globals perform zero steady reads, reprove touched content at most once, then invalidate for global/external/membership/sibling-source edits. These assertions remain in test_transformttsc_persistent_validation_proves_shared_inputs_once, with their stated fixture/oracle limits; portable decisions are not claimed covered by an unnamed unit or by a synthetic envelope alone.
 */
export async function test_transformttsc_persistent_validation_proves_shared_inputs_once(): Promise<void> {
  const { createTtscTransformCache, resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const count = 8;
  const shared = 24;
  const project = createCacheProject({
    aliasedGlobal: true,
    fileCount: count,
    graphFanout: shared,
    graphGlobals: shared,
  });
  const modules = projectModules(project.root);
  let reads = 0;
  const cache = createTtscTransformCache({
    readFile: (location: string) => {
      reads += 1;
      return fs.readFileSync(location);
    },
  });
  const options = resolveOptions();
  const deliver = (file: string) =>
    transformTtsc(
      file,
      fs.readFileSync(file, "utf8"),
      options,
      undefined,
      cache,
    );
  const pluginRuns = (): number =>
    fs.existsSync(project.runLog)
      ? fs.readFileSync(project.runLog, "utf8").length
      : 0;

  for (const file of modules) {
    assert.ok(await deliver(file));
  }
  assert.equal(pluginRuns(), 1);

  reads = 0;
  for (const file of modules) {
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.ok(await deliver(file));
  }
  assert.equal(pluginRuns(), 1, "a steady generation must not recompile");
  // Every module reaches every sibling plus `shared` externals, `shared`
  // globals and one aliased spelling of a global, so the pre-fix path read ~56
  // files per delivery here. Every input of this generation is proven by now,
  // the generation's own current file included: the first loop's second
  // delivery compared its disk bytes against the recorded hash and recorded
  // the signature then. So a proven generation reads nothing at all, and any
  // read means an input lost its proof — which is what the alias and its
  // target do to each other under a per-identity manifest. The envelope stamps
  // no resolution candidates, so no absent path costs a probe read either.
  assert.equal(
    reads,
    0,
    `persistent validation read ${reads} files across ${modules.length} deliveries of a proven generation`,
  );

  // One delivery in isolation, once every input of this generation has been
  // proven: nothing may be read at all. One read means the aliased global lost
  // its own proof to its target's, which a per-identity manifest does on every
  // delivery.
  reads = 0;
  assert.ok(await deliver(modules[1]!));
  assert.equal(
    reads,
    0,
    "an aliased spelling must keep its own proof rather than its target's",
  );

  // A metadata-only change keeps the generation. A repository-owned watcher
  // may prove the bytes untouched without a read; a supplied watcher seam falls
  // back to the content comparison.
  const touched = path.join(
    project.root,
    "node_modules",
    "global0",
    "index.d.ts",
  );
  // A restored-from-backup timestamp: the content is untouched, so only the
  // signature moves.
  const shifted = new Date(0);
  fs.utimesSync(touched, shifted, shifted);
  const beforeTouch = [...cache.values()][0];
  reads = 0;
  assert.ok(await deliver(modules[0]!));
  assert.equal(
    [...cache.values()][0],
    beforeTouch,
    "a metadata-only change must not replace the generation",
  );
  assert.ok(reads <= 1, "metadata-only proof must read the input at most once");
  reads = 0;
  assert.ok(await deliver(modules[1]!));
  // Every input of this generation is proven by now, the generation's own
  // current file included: a sibling delivery compared its disk bytes against
  // the recorded hash and recorded the signature then. Any read here means the
  // touched global was not re-proven and is being reread on every delivery.
  assert.equal(
    reads,
    0,
    "a revalidated input must be proven again, not reread per delivery",
  );

  // The globals half must still invalidate every module, not just one.
  fs.writeFileSync(touched, "declare const ambient0: string;\n", "utf8");
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.ok(await deliver(modules[2]!));
  assert.notEqual(
    [...cache.values()][0],
    beforeTouch,
    "an edited global-scope declaration must replace the generation",
  );
  assert.equal(pluginRuns(), 2, "the edited global must force one recompile");

  // A reachable external edit must still invalidate through the same path.
  const generationAfterGlobal = [...cache.values()][0];
  fs.writeFileSync(
    path.join(project.root, "node_modules", "dep3", "index.d.ts"),
    "export declare const dep3: string;\n",
    "utf8",
  );
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.ok(await deliver(modules[3]!));
  assert.notEqual(
    [...cache.values()][0],
    generationAfterGlobal,
    "a reachable external edit must replace the generation",
  );

  // And so must a project-membership change.
  const generationAfterExternal = [...cache.values()][0];
  fs.writeFileSync(
    path.join(project.root, "src", "added.d.ts"),
    "declare const added: string;\n",
    "utf8",
  );
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.ok(await deliver(modules[4]!));
  assert.notEqual(
    [...cache.values()][0],
    generationAfterExternal,
    "a project-membership change must replace the generation",
  );

  // A sibling source edit must still be seen by the modules that reach it.
  const generationAfterMembership = [...cache.values()][0];
  fs.writeFileSync(
    path.join(project.root, "src", "mod5.ts"),
    'export const value5: string = "PROBE-EDITED";\n',
    "utf8",
  );
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.ok(await deliver(modules[6]!));
  assert.notEqual(
    [...cache.values()][0],
    generationAfterMembership,
    "an edited reachable project source must replace the generation",
  );
}
