import { TestUnpluginProject } from "@ttsc/testing";

import { runTurbopackLoader } from "../../internal/adapter-turbopack/runTurbopackLoader";

/**
 * Verifies the loader transforms TypeScript source through the webpack loader
 * contract using the project's own tsconfig-declared plugins — the exact way
 * Turbopack invokes loaders registered in `turbopack.rules`.
 */
export async function test_turbopack_loader_transforms_source_through_the_webpack_loader_contract(): Promise<void> {
  const root = TestUnpluginProject.createProject();
  const output = await runTurbopackLoader({
    resourcePath: TestUnpluginProject.mainFile(root),
    source: TestUnpluginProject.mainSource(root),
  });
  TestUnpluginProject.assertTransformedToPlugin(output);
}
