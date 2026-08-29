import { assertAFailedCompileWithoutAPassIsStillEvicted } from "../../internal/transform-terminal-verdict";

/**
 * Verifies a host with no pass boundary keeps evicting a failed compile.
 *
 * The retention is scoped to a pass precisely because a long-lived worker has
 * none: Metro and the Turbopack loader must retry on their very next delivery
 * so a transient toolchain failure never becomes permanent for the life of the
 * process. This is the negative twin of the retention, and the property
 * samchon/ttsc#672 established.
 *
 * 1. Plant a type error and use the cache without opening any pass.
 * 2. Deliver two modules, expecting both to reject.
 * 3. Assert the cache is empty after each, so the next delivery retries.
 */
export const test_real_native_envelope_failed_compile_without_a_pass_is_still_evicted =
  async () => {
    await assertAFailedCompileWithoutAPassIsStillEvicted();
  };
