import { TestUnpluginProject } from "@ttsc/testing";
import assert from "node:assert/strict";

import { MetroWorkspace } from "../../../internal/metro/internal/MetroWorkspace";
import { fakeUpstreamOptions } from "../../../internal/metro/internal/metro-snapshot";
import { TestMetroRuntime } from "../../../internal/metro/internal/metro-runtime";

/**
 * Verifies the transformer runs the ttsc plugin pass on TypeScript sources.
 *
 * The end-to-end proof that the adapter actually applies ttsc plugins inside a
 * Metro build: the source handed to the upstream transformer must be the
 * plugin-transformed output, not the original. Exercises the real native
 * compiler and a Go source plugin, so it runs in CI (Go toolchain present).
 *
 * 1. Create the shared fixture project whose tsconfig declares the Go plugin.
 * 2. Run the transformer on its TypeScript entrypoint with the fake upstream.
 * 3. Assert the source the upstream received was plugin-transformed.
 *
 * @evidence contracts/testing.md#behavioral-verification The actual native plugin uppercases the TypeScript fixture and forwards ios options and Babel plugin descriptors through the upstream result.
 * @evidence contracts/testing.md#independent-expectations The fixture operation defines the uppercase output marker independently; literal platform and Babel descriptors must survive the supported transform parameter spread.
 * @evidence contracts/testing.md#distinguishing-cases Project-relative filename reaches the real compiler, contrasting source-unit gating/passthrough and sibling parameter preservation.
 * @evidence contracts/testing.md#execution-ownership Called by test_e2e_metro, which is discovered under src/features and selected by the E2E Evidence claim; this exported scenario executes the compiled Metro package, while source units own its portable decisions.
 * @evidence contracts/e2e.md#necessary-boundary The built Metro transformer must connect relative project routing, actual native transform output and upstream delivery.
 * @evidence contracts/e2e.md#shared-execution One default project transform uses the suite shared immutable Go source and plugin cache. Output and sibling parameter assertions share that request and do not install another consumer. Its project is a slot of the experiment's single workspace, written or copied by MetroWorkspace instead of being created as a separate temporary directory.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The project root anchors src/main.ts, fresh worker options are restored, and the immutable shared producer remains untouched. Entering the slot replaces it, which removes any earlier snapshot, epoch and recorded input, and the experiment removes the whole workspace and verifies its absence once, after the last scenario.
 * @evidence contracts/e2e.md#preserved-coverage Original plugin-output, upstream identity, ios option and Babel plugin-array assertions remain.
 */
export async function case_metro_transformer_runs_the_ttsc_plugin_pass_on_typescript_sources(
  workspace: MetroWorkspace.IWorkspace,
): Promise<void> {
  const root = MetroWorkspace.enterProject(workspace);
  // Mirror real Metro: a project-relative `filename` plus `projectRoot` in
  // options. This exercises the relative→absolute resolution; resolving against
  // cwd instead of projectRoot would make the file look outside the project and
  // silently skip the plugin pass.
  const result = await TestMetroRuntime.runTransform({
    options: fakeUpstreamOptions(),
    params: {
      src: TestUnpluginProject.mainSource(root),
      filename: "src/main.ts",
      options: { projectRoot: root, platform: "ios" },
      plugins: ["babel-plugin-foo"],
    },
  });
  assert.equal(result.ast.__fakeUpstream, true);
  TestUnpluginProject.assertTransformedToPlugin(result.ast.src as string);
  // The transform-path spread must preserve sibling params (options/plugins),
  // not just `src`, a regression dropping them would break Metro's Babel stage.
  assert.equal((result.ast.options as Record<string, unknown>).platform, "ios");
  assert.deepEqual(result.ast.plugins, ["babel-plugin-foo"]);
}
