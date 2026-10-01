import { TestUnpluginProject } from "@ttsc/testing";

import { runTurbopackLoader } from "../../../../internal/unplugin/internal/adapter-turbopack/runTurbopackLoader";

/**
 * Verifies the loader transforms TypeScript through the webpack loader contract
 * with the project's tsconfig plugins.
 *
 * Turbopack invokes every loader registered in `turbopack.rules` through
 * webpack's loader contract, so this is the exact path a Next.js build takes.
 * With no rule options, the tsconfig's own plugins must apply.
 *
 * 1. Create a project whose tsconfig declares the fixture plugin.
 * 2. Run the loader on the entry module through the loader contract.
 * 3. Assert the output is transformed.
 *
 * @evidence contracts/testing.md#behavioral-verification Default loader invocation returns PLUGIN through async callback with tsconfig plugin configuration.
 * @evidence contracts/testing.md#independent-expectations Fixture uppercase rewrite independently fixes expected output.
 * @evidence contracts/testing.md#distinguishing-cases Positive default-options source delivery; options overrides have their own case.
 * @evidence contracts/testing.md#execution-ownership Native-plugin E2E entry test_turbopack_loader_transforms_source_through_the_webpack_loader_contract is discovered under native-plugins/adapters by src/index.ts and @ttsc/test-unplugin start; its body owns the cases above.
 * @evidence contracts/e2e.md#necessary-boundary Built Turbopack entry and native compile execute behind captured webpack loader contract.
 * @evidence contracts/e2e.md#shared-execution Related deliveries reuse fixture and loaded adapter; additional passes/builds own the lifecycle, configuration or host differences above. Fixture builders reuse native artifacts through shared TTSC_CACHE_DIR.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Private fixture project paths separate mutable inputs and project cache identity from other entries. Normal end hooks close modeled owners where invoked; failure/cancellation cleanup lacks a finally guarantee here. Runner exit bounds remaining sessions and tracked roots.
 * @evidence contracts/e2e.md#preserved-coverage Retained assertions: default loader invocation returns PLUGIN through async callback with tsconfig plugin configuration. No portable assertion is transferred or waived; the stated boundary and oracle limitations remain.
 */
export async function test_turbopack_loader_transforms_source_through_the_webpack_loader_contract(): Promise<void> {
  const root = TestUnpluginProject.createProject();
  const output = await runTurbopackLoader({
    resourcePath: TestUnpluginProject.mainFile(root),
    source: TestUnpluginProject.mainSource(root),
  });
  TestUnpluginProject.assertTransformedToPlugin(output);
}
