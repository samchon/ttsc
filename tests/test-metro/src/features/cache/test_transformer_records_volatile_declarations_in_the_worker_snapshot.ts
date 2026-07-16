import { assertTransformerRecordsVolatileDeclarations } from "../../internal/metro-cache";

/**
 * Verifies a plugin-declared volatile transform marks the worker snapshot
 * volatile.
 *
 * The marker is what feeds the nonce degradation on the next run's key; a
 * dropped declaration would let Metro replay outputs that depend on non-file
 * inputs. Exercises the real native compiler, so it runs where the Go toolchain
 * is present (CI).
 *
 * 1. Transform a file through a plugin that declares it volatile.
 * 2. Read this worker's snapshot file.
 * 3. Assert `volatile: true`.
 */
export const test_transformer_records_volatile_declarations_in_the_worker_snapshot =
  async () => {
    await assertTransformerRecordsVolatileDeclarations();
  };
