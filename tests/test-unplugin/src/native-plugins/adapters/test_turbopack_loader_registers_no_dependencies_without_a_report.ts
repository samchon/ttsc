import { TestUnpluginProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import path from "node:path";

import { runTurbopackLoaderWithContext } from "../../internal/adapter-turbopack/runTurbopackLoaderWithContext";
import { universalHostInputs } from "../../internal/adapter-turbopack/universalHostInputs";

/**
 * Verifies a transform without plugin-reported dependencies registers only the
 * universal host inputs.
 *
 * A loader that fabricated other paths would pollute Turbopack's invalidation
 * graph, while omitting the compiler and descriptor inputs that affect every
 * module would serve stale transforms after a descriptor or config edit.
 *
 * 1. Create a project whose plugin reports no dependencies.
 * 2. Run the loader on its entry module.
 * 3. Assert the output is transformed, the registered dependencies are exactly the
 *    universal host inputs, and the development session's bridge, which
 *    observes the project's root files (samchon/ttsc#1419), adds one sentinel
 *    inside the project, since Turbopack fails a module whose dependency leaves
 *    its project filesystem root.
 */
export async function test_turbopack_loader_registers_no_dependencies_without_a_report(): Promise<void> {
  const root = TestUnpluginProject.createProject();
  const { content, dependencies, sentinels } =
    await runTurbopackLoaderWithContext({
      resourcePath: TestUnpluginProject.mainFile(root),
      source: TestUnpluginProject.mainSource(root),
    });
  TestUnpluginProject.assertTransformedToPlugin(content);
  assert.deepEqual(dependencies, universalHostInputs(root));
  assert.equal(sentinels.length, 1, "one bridge sentinel per module");
  // The worker's bridge is opened by its first delivery, whichever project
  // that was, so the tool directory is the first project's.
  assert.match(
    path.dirname(path.dirname(sentinels[0]!)),
    /[\\/]\.ttsc$/,
    "the sentinel lives in a project's own tool directory",
  );
}
