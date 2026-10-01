import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import path from "node:path";

import { fixtureHostInputs } from "../../../../internal/unplugin/internal/transform-graph/fixtureHostInputs";

/**
 * Verifies graph inputs and plugin-reported dependencies register as one
 * deduplicated union.
 *
 * The two channels overlap. An input reported through both must arrive once,
 * while each channel's exclusive entries must still register.
 *
 * 1. Transform with a plugin reporting two dependencies and a graph with two
 *    edges, one path shared.
 * 2. Record every registered watch file.
 * 3. Assert the union of both channels and the universal inputs, with the shared
 *    path once.
 *
 * @evidence contracts/testing.md#behavioral-verification Watch callback receives exact deduplicated shared/only-dependency/only-graph paths plus universal fixture inputs.
 * @evidence contracts/testing.md#independent-expectations Literal configured graph/dependency lists define set union; fixtureHostInputs shares expected host-input construction and limits independence there.
 * @evidence contracts/testing.md#distinguishing-cases Overlap between channels and exclusive paths from each.
 * @evidence contracts/testing.md#execution-ownership Named native-plugin E2E test_transformttsc_registers_graph_and_dependencies_as_a_union is selected under native-plugins/transform by @ttsc/test-unplugin src/index.ts; this body and its invoked helpers own the distinctions above.
 * @evidence contracts/e2e.md#necessary-boundary Built transformTtsc coordinates the actual Go fixture envelope with cache delivery for overlap between channels and exclusive paths from each. A fabricated producer result would not establish that native proofs, output and consumer validation agree; portable helper assertions in this body still do not independently require a host.
 * @evidence contracts/e2e.md#shared-execution One project and loaded API share native fixture artifacts through TTSC_CACHE_DIR. Its modules and request waves reuse the local generation until the stated input/proof/lifecycle changes require replacement; the compile counts above are deliberate state boundaries.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Private project/run-log/cache identities isolate this case's writes; immutable fixture Go sources may share artifact cache, while edited producer sources are copied locally. This body has no finally cache-reset guarantee; runner process exit bounds remaining observers and removes tracked roots. Cache-local seams avoid modifying another case's filesystem provider.
 * @evidence contracts/e2e.md#preserved-coverage Retained assertions: Watch callback receives exact deduplicated shared/only-dependency/only-graph paths plus universal fixture inputs. These tags transfer no portable cases and remove no behavioral checks. Native setup and cleanup limitations above remain explicit.
 */
export async function test_transformttsc_registers_graph_and_dependencies_as_a_union(): Promise<void> {
  const { resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const root = TestUnpluginProject.createProject({ plugins: [] });
  const watched: string[] = [];

  const result = await transformTtsc(
    TestUnpluginProject.mainFile(root),
    TestUnpluginProject.mainSource(root),
    resolveOptions({
      plugins: [
        {
          transform: "./plugin.cjs",
          name: "dependencies",
          operation: "emit-dependencies",
          dependencies: ["src/shared.d.ts", "src/only-dependency.d.ts"],
        },
        {
          transform: "./plugin.cjs",
          name: "graph",
          operation: "emit-graph",
          edges: { "src/main.ts": ["src/shared.d.ts", "src/only-graph.d.ts"] },
        },
      ],
    }),
    undefined,
    undefined,
    { addWatchFile: (file: string) => watched.push(file) },
  );

  assert.ok(result);
  assert.deepEqual(
    [...watched].sort(),
    [
      path.join(root, "src", "shared.d.ts"),
      path.join(root, "src", "only-dependency.d.ts"),
      path.join(root, "src", "only-graph.d.ts"),
      ...fixtureHostInputs(root),
    ].sort(),
  );
}
