import { assertPersistentBannerConfigSupersessionInvalidatesTransform } from "../../internal/transform-utility-plugin-config";

/**
 * Verifies a nearer banner config replaces a cached generation.
 *
 * Config discovery walks upward and stops at the first directory that answers,
 * so every candidate it probed on the way can change the answer. Reporting only
 * the file it found leaves a warm generation unable to notice a nearer one, and
 * the build then disagrees with a cold run about which config the project has
 * (samchon/ttsc#1271).
 *
 * 1. Compile a package nested two directories below its banner config.
 * 2. Create a nearer banner config in the directory between them, which is outside
 *    the project walk, so nothing but the reported probe can see it.
 * 3. Assert the next delivery carries the nearer config's text.
 */
export const test_transformttsc_persistent_banner_config_supersession_invalidates_transform =
  async () => {
    await assertPersistentBannerConfigSupersessionInvalidatesTransform();
  };
