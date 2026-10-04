import {
  TestProject,
  TestUnpluginProject,
  TestUnpluginRuntime,
} from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { GRAPH } from "../../../../internal/unplugin/internal/transform-complete/GRAPH";
import { declareComplete } from "../../../../internal/unplugin/internal/transform-complete/declareComplete";
import { fixtureHostInputs } from "../../../../internal/unplugin/internal/transform-complete/fixtureHostInputs";
import { member } from "../../../../internal/unplugin/internal/transform-complete/member";
import { reportDependencies } from "../../../../internal/unplugin/internal/transform-complete/reportDependencies";
import { emitGraphPlugins } from "../../../../internal/unplugin/internal/transform-graph/emitGraphPlugins";

/**
 * Verifies a mixed completeness envelope composes per file.
 *
 * One transform can declare `src/main.ts` complete and say nothing about
 * `src/other.ts`. Each file's watch derivation must follow its own status
 * against that single envelope: the declared file narrows to its reported
 * dependencies, and the silent one keeps its graph reach.
 *
 * 1. Transform with a plugin that reports a dependency, a graph, and a
 *    completeness declaration for `src/main.ts` only.
 * 2. Assert `src/main.ts` registers only its reported dependency and the universal
 *    inputs.
 * 3. Assert `src/other.ts` registers its graph reach and the universal inputs.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual native transform emits one envelope for two modules; successful deliveries assert complete main narrows to consulted input while unmarked other retains its graph edge and ambient file. Main output retains the literal quoted PLUGIN marker; an external producer byte log must record exactly one native transform across both deliveries.
 * @evidence contracts/testing.md#independent-expectations The literal GRAPH and plugin operations define independent per-file expected lists, including universal host/config/source inputs and the absent nearer routing config; neither expected list comes from the selector.
 * @evidence contracts/testing.md#distinguishing-cases The same generation contrasts one explicitly complete module with an unmarked module. Dedicated source units own empty complete dependencies, an off-graph declared dependency and contradictory complete/volatile watch derivation.
 * @evidence contracts/testing.md#execution-ownership The named native E2E entry uses the actual built public API and Go-source fixture producer, then two module deliveries through one cache. Pure dependency/watch derivations execute separately under unit/transform.
 * @evidence contracts/e2e.md#necessary-boundary Native plugin operations, decoded dependenciesComplete/graph metadata and public adapter delivery must connect; source units cannot detect producer fields omitted or misassigned while constructing a mixed envelope.
 * @evidence contracts/e2e.md#shared-execution Both module assertions use one fixture root, options and cache so the second delivery consumes the first generation. One-byte-per-transform count-runs observes actual producer invocation rather than inferring reuse from equal output. The content-addressed default Go fixture producer is reused across suite consumers.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity An isolated root and new cache separate envelope metadata from other cases; module source and options remain unchanged between deliveries. The run log lives outside the consumer root. A finally block resets the local cache after success or failure; that supported API begins generation retirement and is not claimed to join every OS process. Both module failures are collected before this reset.
 * @evidence contracts/e2e.md#preserved-coverage Both successful deliveries and their exact per-file watch lists remain here. The quoted PLUGIN output assertion preserves the graph-reach entry's marker check. Source unit test_watch_inputs_preserve_graph_dependency_and_alias_rules directly owns universal-only, transitive-cycle/global/config, graph/dependency union and two lexical-alias watch lists; native alias delivery still retains its separate selection boundary. Transferred narrow, empty and volatile watch-list assertions retain their source-unit entries; volatile cache eviction and fresh delivery notifications execute in tests/test-unplugin/src/features/transform/test_cached_generation_action_keeps_or_replaces_the_actual_owner.ts, while test_transformttsc_ignores_completeness_for_a_volatile_file owns the watch union. The retired generic producer timestamp was a consumer witness, not supported driver-native volatile acquisition; the common pool does not certify that acquisition.
 */
export async function test_transformttsc_composes_a_mixed_completeness_envelope_per_file(): Promise<void> {
  const {
    resolveOptions,
    transformTtsc,
    createTtscTransformCache,
    resetTtscTransformCache,
  } = await TestUnpluginRuntime.loadUnpluginApi();
  const root = TestUnpluginProject.createProject({ plugins: [] });
  const other = path.join(root, "src", "other.ts");
  fs.writeFileSync(other, "export const other: number = 1;\n", "utf8");
  const runLog = path.join(
    TestProject.tmpdir("ttsc-mixed-envelope-count-"),
    "runs",
  );
  const options = resolveOptions({
    plugins: [
      reportDependencies(["src/consulted.d.ts"]),
      ...emitGraphPlugins(GRAPH),
      {
        transform: "./plugin.cjs",
        name: "echo",
        operation: "echo-file",
        path: "src/other.ts",
      },
      declareComplete(["src/main.ts"]),
      {
        transform: "./plugin.cjs",
        name: "count",
        operation: "count-runs",
        runLog,
      },
    ],
  });
  // One shared cache, so both files read out of one envelope the way a bundler
  // calls the adapter file by file over a single project transform.
  const cache = createTtscTransformCache();
  const failures: Error[] = [];
  const observe = async (label: string, body: () => Promise<void>) => {
    try {
      await body();
    } catch (error) {
      failures.push(new Error(label, { cause: error }));
    }
  };

  try {
    const collect = async (file: string): Promise<string[]> => {
      const watched: string[] = [];
      const result = await transformTtsc(
        file,
        fs.readFileSync(file, "utf8"),
        options,
        undefined,
        cache,
        { addWatchFile: (input: string) => watched.push(input) },
      );
      assert.ok(result);
      if (file === TestUnpluginProject.mainFile(root))
        assert.match(result.code, /"PLUGIN"/);
      return [...watched].sort();
    };

    await observe("complete main delivery", async () =>
      assert.deepEqual(
        await collect(TestUnpluginProject.mainFile(root)),
        [member(root, "src/consulted.d.ts"), ...fixtureHostInputs(root)].sort(),
      ),
    );
    await observe("unmarked other delivery", async () =>
      assert.deepEqual(
        await collect(other),
        [
          member(root, "src/other-type.d.ts"),
          member(root, "src/ambient.d.ts"),
          ...fixtureHostInputs(root),
        ].sort(),
      ),
    );
    await observe("one shared native envelope", async () =>
      assert.equal(fs.readFileSync(runLog).byteLength, 1),
    );
    if (failures.length !== 0)
      throw new AggregateError(
        failures,
        "mixed completeness envelope failures",
      );
  } finally {
    resetTtscTransformCache(cache);
  }
}
