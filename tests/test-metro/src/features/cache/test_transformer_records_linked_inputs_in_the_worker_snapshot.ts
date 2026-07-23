import { assertTransformerRecordsLinkedInput } from "../../internal/metro-cache";

/**
 * Verifies Metro records linked graph inputs in the worker snapshot.
 *
 * Metro's project fingerprint shares the Unplugin walk predicate. A path below
 * the project root is not actually fingerprinted when a symbolic link or
 * Windows junction leads to it, so the graph snapshot must retain that path.
 *
 * 1. Link an in-project directory to an external declaration.
 * 2. Transform with a plugin-reported dependency through the linked spelling.
 * 3. Assert the worker snapshot records that spelling as an external input.
 */
export const test_transformer_records_linked_inputs_in_the_worker_snapshot =
  async () => {
    await assertTransformerRecordsLinkedInput();
  };
