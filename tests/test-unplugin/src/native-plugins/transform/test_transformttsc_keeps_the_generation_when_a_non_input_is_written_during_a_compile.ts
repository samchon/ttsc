import assert from "node:assert/strict";

import { runProjectBuild } from "../../internal/transform-project-cache/runProjectBuild";

/**
 * Verifies samchon/ttsc#1246: a file written inside the project root during a
 * compile does not cost the generation when it is not an input of that
 * compile.
 *
 * A project root is a working directory. A framework's generated types, a
 * coverage report, a log, or a test artifact appears and changes there while a
 * compile runs, and comparing every walked file made those generations
 * incoherent, which cost a whole-project recompile per delivered module. Only a
 * declared input can change an output; files entering or leaving the project
 * stay covered by the directory-membership snapshot.
 *
 * 1. Build a six-file project whose fixture transform rewrites
 *    `fixtures/build.log` (never an input) on every run.
 * 2. Run a transform over every module sharing one persistent cache.
 * 3. Assert the plugin ran exactly once.
 */
export async function test_transformttsc_keeps_the_generation_when_a_non_input_is_written_during_a_compile(): Promise<void> {
  const { pluginRuns, outputs } = await runProjectBuild({
    fileCount: 6,
    graphFanout: 4,
    nonInputRaceFile: "fixtures/build.log",
  });
  assert.equal(pluginRuns, 1);
  assert.equal(outputs.length, 6);
}
