import { assertCompileSnapshotAbaRaceCannotAuthorizeStaleOutput } from "../../internal/transform-project-cache";

/**
 * Verifies an ABA mutation during native compilation is stabilized in place.
 *
 * Equal pre/post bytes cannot prove which bytes produced the output. The
 * compiler-time graph proof detects the transient read even after the file is
 * restored, and the cache Promise must discard that attempt before resolving.
 *
 * 1. Rewrite one source A-to-B-to-A while the first transform reads B.
 * 2. Let the shared generation retry after the one-shot race settles.
 * 3. Assert two compiles, no B output, and reuse of the stable retry.
 */
export const test_transformttsc_compile_snapshot_aba_race_cannot_authorize_stale_output =
  async () => {
    await assertCompileSnapshotAbaRaceCannotAuthorizeStaleOutput();
  };
