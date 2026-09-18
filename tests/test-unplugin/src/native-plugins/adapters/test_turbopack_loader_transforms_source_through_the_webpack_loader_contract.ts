import { TestUnpluginProject } from "@ttsc/testing";

import { runTurbopackLoader } from "../../internal/adapter-turbopack/runTurbopackLoader";

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
 */
export async function test_turbopack_loader_transforms_source_through_the_webpack_loader_contract(): Promise<void> {
  const root = TestUnpluginProject.createProject();
  const output = await runTurbopackLoader({
    resourcePath: TestUnpluginProject.mainFile(root),
    source: TestUnpluginProject.mainSource(root),
  });
  TestUnpluginProject.assertTransformedToPlugin(output);
}
