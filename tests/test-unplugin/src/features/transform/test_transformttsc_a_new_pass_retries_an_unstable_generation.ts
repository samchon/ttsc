import { assertANewPassRetriesAnUnstableGeneration } from "../../internal/transform-delivery-epoch";

/**
 * Verifies a new pass grants an unstable generation one fresh attempt.
 *
 * The half of the terminal-verdict rule that is easy to lose. A failed compile
 * is the host's answer about inputs it read, so a new pass replays it; an
 * unstable generation is the adapter losing a race, which a later attempt may
 * win, so a new pass has to try again. That fresh attempt is what the per-pass
 * cache clear used to provide for free, and removing the branch that grants it
 * would leave every other case green.
 *
 * 1. Block one directory's walk so no attempt can prove a coherent snapshot.
 * 2. Open a pass, deliver, and assert a second delivery replays the verdict.
 * 3. Open a new pass and assert it spends a fresh attempt, then unblock and assert
 *    recovery.
 */
export const test_transformttsc_a_new_pass_retries_an_unstable_generation =
  async () => {
    await assertANewPassRetriesAnUnstableGeneration();
  };
