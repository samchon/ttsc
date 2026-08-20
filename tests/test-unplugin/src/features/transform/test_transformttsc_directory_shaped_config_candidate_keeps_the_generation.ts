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
 * 1. Compile a package whose config directory also carries a directory named
 *    `banner.config.ts`.
 * 2. Assert that path reached the envelope.
 * 3. Deliver again and assert the generation object is the same one.
 */
export const test_transformttsc_directory_shaped_config_candidate_keeps_the_generation =
  async () => {
    await assertDirectoryShapedConfigCandidateKeepsTheGeneration();
  };
