import { assertHashedBundleOutputKeepsTheGeneration } from "../../internal/transform-program-membership";

/**
 * See {@link assertHashedBundleOutputKeepsTheGeneration} for what this proves
 * and why the previous behaviour was wrong (samchon/ttsc#1307).
 */
export const test_transformttsc_hashed_bundle_output_keeps_the_generation =
  async () => {
    await assertHashedBundleOutputKeepsTheGeneration();
  };
