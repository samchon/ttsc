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
 * plugin-transformed output through an authored echo upstream. This calls the
 * adapter rather than starting an actual Metro server. Exercises the real native
 * compiler and a Go source plugin, so it runs in CI (Go toolchain present).
 *
 * 1. Create the shared fixture project whose tsconfig declares the Go plugin.
 * 2. Run the transformer on its TypeScript entrypoint with the fake upstream.
 * 3. Assert the source the upstream received was plugin-transformed.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual native output contains PLUGIN and no goUpper, the authored echo upstream marks its result, and ios plus the exact Babel descriptor array survive forwarding. The helper does not compare the entire generated source or an exact uppercase token.
 * @evidence contracts/testing.md#independent-expectations The fixture operation defines the uppercase output marker independently; literal platform and Babel descriptors must survive the supported transform parameter spread.
 * @evidence contracts/testing.md#distinguishing-cases Project-relative filename reaches the real compiler, contrasting source-unit gating/passthrough and sibling parameter preservation.
 * @evidence contracts/testing.md#execution-ownership test_e2e_metro invokes this selected relative-filename/native delivery scenario through default built transformer modules unless TTSC_TEST_LAYER=unit. Source override is not built-boundary proof, and the echo upstream is not a Metro server or OS worker.
 * @evidence contracts/e2e.md#necessary-boundary The built Metro transformer must connect relative project routing, actual native transform output and upstream delivery.
 * @evidence contracts/e2e.md#shared-execution One default fixture and awaited transform share selected producer artifacts for marker/source-call absence and sibling parameter assertions. One parent request does not count native processes, Programs or cache hits; no consumer installation or per-parameter producer is prepared.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The project root anchors src/main.ts; slot reset drops old records and runtime options env restores after awaited transformation. Parent collection separately retains workspace cleanup errors. Query module freshness/results/paths do not certify arbitrary descendant joins or loaded-image equality.
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
