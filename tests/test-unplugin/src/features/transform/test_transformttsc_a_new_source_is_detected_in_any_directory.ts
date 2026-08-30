import { assertANewSourceIsDetectedInAnyDirectory } from "../../internal/transform-program-membership";

/**
 * See {@link assertANewSourceIsDetectedInAnyDirectory} for what this proves and
 * why the previous behaviour was wrong (samchon/ttsc#1307).
 */
export const test_transformttsc_a_new_source_is_detected_in_any_directory =
  async () => {
    await assertANewSourceIsDetectedInAnyDirectory();
  };
