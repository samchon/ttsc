import { assertDirectoryShapedConfigCandidateKeepsTheGeneration } from "../../internal/transform-utility-plugin-config";

/**
 * Verifies a directory wearing a config file's name keeps the generation
 * reusable.
 *
 * The boundary inside samchon/ttsc#1271's reporting. A rejected candidate that
 * is a directory is not the same observation as an absent one: the host-input
 * contract records it by a directory-kind digest and its physical path, and
 * reporting it as absent instead leaves every consumer comparing a nil against
 * a digest its own filesystem keeps producing — the generation is then refused
 * on every delivery for the rest of its life rather than invalidated once.
 *
 * 1. Compile a package whose nearer config directory carries a directory named
 *    `banner.config.json` while an outer config supplies the banner.
 * 2. Assert that path's digest and physical identity reached a complete envelope,
 *    then deliver again and retain the same generation.
 * 3. Replace the directory with a real config, require one new generation and its
 *    nearer banner, then deliver once more and retain that generation.
 */
export const test_transformttsc_directory_shaped_config_candidate_keeps_the_generation =
  async () => {
    await assertDirectoryShapedConfigCandidateKeepsTheGeneration();
  };
