import { assertTransformerRecordsVolatileDeclarations } from "../../../internal/metro/internal/metro-cache";

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
 *
 * @evidence contracts/testing.md#behavioral-verification Actual native plugin metadata creates one worker snapshot with volatile:true for its transformed entry.
 * @evidence contracts/testing.md#independent-expectations The authored plugin declaration independently marks src/main.ts volatile; exact worker count and boolean establish delivery.
 * @evidence contracts/testing.md#distinguishing-cases Positive volatility delivery complements recorder-only volatile-to-clean recovery and key nonreuse source cases.
 * @evidence contracts/testing.md#execution-ownership This named features export test_transformer_records_volatile_declarations_in_the_worker_snapshot executes the compiled Metro package in the E2E runner; source units own its portable decisions and the leaf helper retains this case assertions.
 * @evidence contracts/e2e.md#necessary-boundary The native producer must transmit plugin-declared volatility through the transform callback into persisted Metro state.
 * @evidence contracts/e2e.md#shared-execution One native project/plugin observation uses the suite shared producer and creates one snapshot; no per-assertion build, installation or extra host starts.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The project and worker directory are case-owned; environment options restore after transformation and tracked temporary/cache resources end with runner cleanup.
 * @evidence contracts/e2e.md#preserved-coverage Original one-worker and volatile:true assertions remain at the actual compiler connection.
 */
export const test_transformer_records_volatile_declarations_in_the_worker_snapshot =
  async () => {
    await assertTransformerRecordsVolatileDeclarations();
  };
