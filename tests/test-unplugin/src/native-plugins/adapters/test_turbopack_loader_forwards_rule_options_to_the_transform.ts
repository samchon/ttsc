import { TestUnpluginProject } from "@ttsc/testing";
import assert from "node:assert/strict";

import { runTurbopackLoader } from "../../internal/adapter-turbopack/runTurbopackLoader";

/**
 * Verifies the rule's `options` object reaches the transform: a plugin list
 * passed through loader options must override the tsconfig-declared plugins,
 * here proven by the fixture's `go-prefix` operation reshaping the output.
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
