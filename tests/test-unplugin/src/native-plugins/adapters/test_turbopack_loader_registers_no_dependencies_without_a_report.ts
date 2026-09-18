import { TestUnpluginProject } from "@ttsc/testing";
import assert from "node:assert/strict";

import { runTurbopackLoaderWithContext } from "../../internal/adapter-turbopack/runTurbopackLoaderWithContext";
import { universalHostInputs } from "../../internal/adapter-turbopack/universalHostInputs";

/**
 * Verifies the negative twin: a transform whose plugin reports no per-file
 * `dependencies` registers only the compiler/descriptor inputs that affect
 * every module. A loader that fabricated other paths would pollute Turbopack's
 * invalidation graph, while omitting these universal inputs would serve stale
 * transforms after a descriptor or config edit.
 */
export async function test_turbopack_loader_registers_no_dependencies_without_a_report(): Promise<void> {
  const root = TestUnpluginProject.createProject();
  const { content, dependencies } = await runTurbopackLoaderWithContext({
    resourcePath: TestUnpluginProject.mainFile(root),
    source: TestUnpluginProject.mainSource(root),
  });
  TestUnpluginProject.assertTransformedToPlugin(content);
  assert.deepEqual(dependencies, universalHostInputs(root));
}
