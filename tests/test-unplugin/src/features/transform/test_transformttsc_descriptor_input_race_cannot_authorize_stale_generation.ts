import { assertDescriptorInputRaceCannotAuthorizeStaleGeneration } from "../../internal/transform-project-cache";

/**
 * Verifies descriptor results retain the input state observed during their
 * evaluation, rather than a later snapshot captured after a candidate appears.
 *
 * A descriptor can resolve an extensionless import and create a higher-priority
 * candidate inside its factory. Hashing only after the factory returns pairs
 * the old result with the new filesystem state and authorizes stale reuse.
 *
 * 1. Resolve a descriptor import through a lower-priority JSON candidate.
 * 2. Create the higher-priority JavaScript candidate inside the factory.
 * 3. Assert the first delivery stabilizes by retrying and later reuses it.
 */
export const test_transformttsc_descriptor_input_race_cannot_authorize_stale_generation =
  async () => {
    await assertDescriptorInputRaceCannotAuthorizeStaleGeneration();
  };
