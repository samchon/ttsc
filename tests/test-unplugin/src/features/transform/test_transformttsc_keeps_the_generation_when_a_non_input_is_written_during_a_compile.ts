import { assertNonInputWriteDuringCompileKeepsGeneration } from "../../internal/transform-project-cache";

/**
 * Verifies samchon/ttsc#1246: a non-input write during a compile is harmless.
 *
 * The project walk hashes every file under the project root, but a project root
 * is a working directory: generated types, logs, and test artifacts appear and
 * change there while a compile runs. Comparing them declared the generation
 * incoherent, which cost a whole-project recompile for every remaining module.
 *
 * 1. Build a six-file project whose transform rewrites `fixtures/build.log` on
 *    every run.
 * 2. Transform every module through one persistent cache.
 * 3. Assert the plugin ran once.
 */
export const test_transformttsc_keeps_the_generation_when_a_non_input_is_written_during_a_compile =
  async () => {
    await assertNonInputWriteDuringCompileKeepsGeneration();
  };
