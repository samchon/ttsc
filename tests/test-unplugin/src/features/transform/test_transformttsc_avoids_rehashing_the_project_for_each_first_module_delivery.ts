import { assertFirstModuleDeliveriesDoNotRehashProject } from "../../internal/transform-project-cache";

/**
 * Verifies a cached whole-project transform selects first-use modules in O(1).
 *
 * The compiler already produced every module and the generation snapshot.
 * Re-reading all project files before each module selection turns an N-file
 * initial build into N complete project walks.
 *
 * 1. Compile a 24-module project and cache its whole-project result.
 * 2. Count project reads while requesting every remaining module once.
 * 3. Assert no project file was re-read and the native transform ran once.
 */
export const test_transformttsc_avoids_rehashing_the_project_for_each_first_module_delivery =
  async () => {
    await assertFirstModuleDeliveriesDoNotRehashProject();
  };
