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
