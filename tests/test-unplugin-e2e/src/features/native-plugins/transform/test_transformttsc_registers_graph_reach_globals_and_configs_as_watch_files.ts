import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import path from "node:path";

import { emitGraphPlugins } from "../../../internal/transform-graph/emitGraphPlugins";
import { fixtureHostInputs } from "../../../internal/transform-graph/fixtureHostInputs";

/**
 * Verifies the transform registers the graph's reach from the module, plus
 * `globals` and `configs`.
 *
 * The reachability closure must be transitive, through chains the bundler
 * cannot see, and ignore edges the module cannot reach. Every path is
 * absolutized against the project root and deduplicated, and the module itself
 * is excluded even when a cycle or the globals list points back at it.
 *
 * 1. Transform with a graph holding a transitive chain, a cycle back to the
 *    module, an unreachable edge, globals, and configs.
 * 2. Record every registered watch file.
 * 3. Assert exactly the reachable closure, globals, configs, and universal inputs,
 *    without the module itself.
 *
 * @evidence contracts/testing.md#behavioral-verification Output is PLUGIN and exact watch set contains transitive a/b, ambient and host inputs without self or unreachable path.
 * @evidence contracts/testing.md#independent-expectations Authored graph makes reachable closure independently enumerable; host-input helper may share universal-input assumptions.
 * @evidence contracts/testing.md#distinguishing-cases Transitive chain, cycle to self, unreachable edge, globals/self and config overlap.
 * @evidence contracts/testing.md#execution-ownership Named native-plugin E2E test_transformttsc_registers_graph_reach_globals_and_configs_as_watch_files is selected under native-plugins/transform by @ttsc/test-unplugin src/index.ts; this body and its invoked helpers own the distinctions above.
 * @evidence contracts/e2e.md#necessary-boundary Built transformTtsc coordinates the actual Go fixture envelope with cache delivery for transitive chain, cycle to self, unreachable edge, globals/self and config overlap. A fabricated producer result would not establish that native proofs, output and consumer validation agree; portable helper assertions in this body still do not independently require a host.
 * @evidence contracts/e2e.md#shared-execution One project and loaded API share native fixture artifacts through TTSC_CACHE_DIR. Its modules and request waves reuse the local generation until the stated input/proof/lifecycle changes require replacement; the compile counts above are deliberate state boundaries.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Private project/run-log/cache identities isolate this case's writes; immutable fixture Go sources may share artifact cache, while edited producer sources are copied locally. This body has no finally cache-reset guarantee; runner process exit bounds remaining observers and removes tracked roots. Cache-local seams avoid modifying another case's filesystem provider.
 * @evidence contracts/e2e.md#preserved-coverage Retained assertions: Output is PLUGIN and exact watch set contains transitive a/b, ambient and host inputs without self or unreachable path. These tags transfer no portable cases and remove no behavioral checks. Native setup and cleanup limitations above remain explicit.
 */
export async function test_transformttsc_registers_graph_reach_globals_and_configs_as_watch_files(): Promise<void> {
  const { resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const root = TestUnpluginProject.createProject({ plugins: [] });
  const watched: string[] = [];

  const result = await transformTtsc(
    TestUnpluginProject.mainFile(root),
    TestUnpluginProject.mainSource(root),
    resolveOptions({
      plugins: emitGraphPlugins({
        edges: {
          "src/main.ts": ["src/a.d.ts"],
          // a -> b proves transitive reach; a -> main proves the module
          // itself stays excluded even through a cycle.
          "src/a.d.ts": ["src/b.d.ts", "src/main.ts"],
          // Unreachable from main.ts; must not be registered.
          "src/other.ts": ["src/unrelated.d.ts"],
        },
        globals: ["src/ambient.d.ts", "src/main.ts"],
        configs: ["tsconfig.json"],
      }),
    }),
    undefined,
    undefined,
    { addWatchFile: (file: string) => watched.push(file) },
  );

  assert.ok(result);
  assert.match(result.code, /"PLUGIN"/);
  assert.deepEqual(
    [...watched].sort(),
    [
      path.join(root, "src", "a.d.ts"),
      path.join(root, "src", "b.d.ts"),
      path.join(root, "src", "ambient.d.ts"),
      ...fixtureHostInputs(root),
    ].sort(),
  );
}
