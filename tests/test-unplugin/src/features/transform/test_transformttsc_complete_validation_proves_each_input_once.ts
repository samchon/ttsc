import { assertCompleteValidationProvesEachInputOnce } from "../../internal/transform-project-cache";

/**
 * Verifies the whole-snapshot path proves each input once per generation.
 *
 * With notifications unavailable every delivery re-proves the recorded snapshot
 * from disk, so unless the walk that proved it hands its signatures back, a
 * metadata-only change to any input costs a re-read for the rest of the
 * generation's life. The delivered file is the one input that must not receive
 * a disk signature: its recorded hash is the source the bundler supplied, so
 * stamping one would let a later sibling delivery reuse a hash the disk no
 * longer carries.
 *
 * 1. Refuse every watch registration so every delivery takes the whole-snapshot
 *    path, and measure its steady per-delivery read count.
 * 2. Touch one project input and one out-of-walk input: the next delivery falls
 *    back to the content comparison, and the delivery after it returns to the
 *    steady count.
 * 3. Deliver a file whose disk content has moved ahead of the supplied source,
 *    then deliver a sibling and assert the drift is still seen.
 */
export const test_transformttsc_complete_validation_proves_each_input_once =
  async () => {
    await assertCompleteValidationProvesEachInputOnce();
  };
