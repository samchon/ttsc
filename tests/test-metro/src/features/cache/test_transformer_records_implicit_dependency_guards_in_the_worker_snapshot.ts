import { assertTransformerRecordsImplicitDependencyGuards } from "../../internal/metro-cache";

/**
 * Verifies the worker snapshot guards every implicit-project dependency.
 *
 * The worker compares the complete derived set with the exact main-process run
 * baseline, retains inputs outside proven static coverage, and taints any
 * temporal mismatch. Exercises the real native compiler, so it runs where the
 * Go toolchain is present (CI).
 *
 * 1. Transform a file whose plugin reports one in-project and one out-of-project
 *    dependency.
 * 2. Read the worker snapshot.
 * 3. Assert the static input is proven without duplication, external inputs are
 *    retained in one batch, the first discovery rotates the epoch, and the
 *    unchanged second run stabilizes.
 * 4. Assert a directory-link A-to-B-to-A race rotates the epoch even when the
 *    input bytes return to their original value.
 */
export const test_transformer_records_implicit_dependency_guards_in_the_worker_snapshot =
  async () => {
    await assertTransformerRecordsImplicitDependencyGuards();
  };
