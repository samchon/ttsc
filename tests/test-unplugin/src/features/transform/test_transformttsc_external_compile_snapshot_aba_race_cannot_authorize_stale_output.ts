import { assertExternalCompileSnapshotAbaRaceCannotAuthorizeStaleOutput } from "../../internal/transform-project-cache";

/**
 * Verifies external graph-input ABA churn stabilizes before cache publication.
 *
 * External files do not belong to the project walk, so their compiler-time
 * proof and the adapter's out-of-walk snapshot are the only coherent boundary.
 * Restored bytes must not authorize output produced from the transient state.
 *
 * 1. Rewrite one external declaration A-to-B-to-A during the first compile.
 * 2. Let the shared generation retry after the one-shot race settles.
 * 3. Assert two compiles, no B output, and reuse of the stable retry.
 */
export const test_transformttsc_external_compile_snapshot_aba_race_cannot_authorize_stale_output =
  async () => {
    await assertExternalCompileSnapshotAbaRaceCannotAuthorizeStaleOutput();
  };
