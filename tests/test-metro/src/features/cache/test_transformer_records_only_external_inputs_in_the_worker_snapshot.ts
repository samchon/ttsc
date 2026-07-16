import { assertTransformerRecordsOnlyExternalInputs } from "../../internal/metro-cache";

/**
 * Verifies the worker snapshot records only out-of-walk inputs.
 *
 * The project walk already fingerprints everything under the project root, so
 * recording in-project dependencies would only bloat the snapshot and the
 * per-run re-hash; the out-of-walk classification is the load-bearing filter.
 * Exercises the real native compiler, so it runs where the Go toolchain is
 * present (CI).
 *
 * 1. Transform a file whose plugin reports one in-project and one out-of-project
 *    dependency.
 * 2. Read the worker snapshot.
 * 3. Assert it contains exactly the out-of-project path.
 */
export const test_transformer_records_only_external_inputs_in_the_worker_snapshot =
  async () => {
    await assertTransformerRecordsOnlyExternalInputs();
  };
