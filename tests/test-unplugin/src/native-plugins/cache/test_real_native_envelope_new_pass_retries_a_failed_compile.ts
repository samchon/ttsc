import { assertANewPassRetriesAFailedCompile } from "../../internal/transform-terminal-verdict";

/**
 * Verifies the next pass attempts a failed compile again.
 *
 * A pass verdict is deliberately not proven against a recorded environment: an
 * ordinary type error arrives as an `"exception"` carrying the compiler's own
 * diagnostic text, exactly as a crashed host would, so the adapter cannot tell
 * a project answer from an infrastructure failure. A new pass is the first
 * boundary at which the host itself claims something may have changed, which is
 * what keeps a transient failure from becoming permanent.
 *
 * 1. Plant a type error, open a pass, and deliver a module.
 * 2. Open a second pass and deliver the same module again.
 * 3. Assert a new generation was attempted, and that the rest of that pass replays
 *    its verdict.
 */
export const test_real_native_envelope_new_pass_retries_a_failed_compile =
  async () => {
    await assertANewPassRetriesAFailedCompile();
  };
