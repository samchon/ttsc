import { TestUnpluginProject } from "@ttsc/testing";
import assert from "node:assert/strict";

import { runTurbopackLoader } from "../../internal/adapter-turbopack/runTurbopackLoader";

/**
 * Verifies the rule's `options` object reaches the transform and overrides the
 * tsconfig plugins.
 *
 * Turbopack passes loader configuration only through rule options. If they
 * never reached the transform, a Next.js project could not configure plugins
 * per rule and would silently get the tsconfig's list instead.
 *
 * 1. Create a project with no tsconfig plugins.
 * 2. Run the loader with a `prefix` plugin in its rule options.
 * 3. Assert the output carries that plugin's prefix.
 *
 * @evidence contracts/testing.md#behavioral-verification Built loader returns A:plugin with rule-supplied prefix while tsconfig plugins are empty.
 * @evidence contracts/testing.md#independent-expectations Literal configured A prefix independently distinguishes options propagation.
 * @evidence contracts/testing.md#distinguishing-cases Rule options override an empty project list; default project options have a companion case.
 * @evidence contracts/testing.md#execution-ownership Native-plugin E2E entry test_turbopack_loader_forwards_rule_options_to_the_transform is discovered under native-plugins/adapters by src/index.ts and @ttsc/test-unplugin start; its body owns the cases above.
 * @evidence contracts/e2e.md#necessary-boundary Captured webpack loader callback invokes the built Turbopack entry and native transform, without launching Next.
 * @evidence contracts/e2e.md#shared-execution Related deliveries reuse fixture and loaded adapter; additional passes/builds own the lifecycle, configuration or host differences above. Fixture builders reuse native artifacts through shared TTSC_CACHE_DIR.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Private fixture project paths separate mutable inputs and project cache identity from other entries. Normal end hooks close modeled owners where invoked; failure/cancellation cleanup lacks a finally guarantee here. Runner exit bounds remaining sessions and tracked roots.
 * @evidence contracts/e2e.md#preserved-coverage Retained assertions: built loader returns A:plugin with rule-supplied prefix while tsconfig plugins are empty. No portable assertion is transferred or waived; the stated boundary and oracle limitations remain.
 */
export async function test_turbopack_loader_forwards_rule_options_to_the_transform(): Promise<void> {
  const root = TestUnpluginProject.createProject({ plugins: [] });
  const output = await runTurbopackLoader({
    resourcePath: TestUnpluginProject.mainFile(root),
    source: TestUnpluginProject.mainSource(root),
    options: {
      plugins: [{ transform: "./plugin.cjs", name: "prefix", prefix: "A:" }],
    },
  });
  assert.match(output, /"A:plugin"/);
}
