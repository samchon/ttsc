import { assertTransformerRecordsLinkedInput } from "../../../internal/metro/internal/metro-cache";

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
 *
 * @evidence contracts/testing.md#behavioral-verification An actual native reporter dependency through a directory link retains the lexical linked path plus exact config/descriptor inputs and Go source tree.
 * @evidence contracts/testing.md#independent-expectations The authored link spelling and literal expected fixture paths independently specify compiler-visible identity outside the static walk.
 * @evidence contracts/testing.md#distinguishing-cases Linked in-project spelling contrasts ordinary in-walk sources and an external unlinked helper.
 * @evidence contracts/testing.md#execution-ownership This named features export test_transformer_records_linked_inputs_in_the_worker_snapshot executes the compiled Metro package in the E2E runner; source units own its portable decisions and the leaf helper retains this case assertions.
 * @evidence contracts/e2e.md#necessary-boundary Compiler-derived dependency spelling must survive the real transform callback and be recorded under its lexical link identity.
 * @evidence contracts/e2e.md#shared-execution One linked fixture and native reporter compile use the suite shared immutable producer/cache; exact input assertions share that single worker observation.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity A case-local link targets a separate tracked declaration directory, and the worker options restore after the call. Neither shared source nor foreign fixtures are edited; runner cleanup owns both directories.
 * @evidence contracts/e2e.md#preserved-coverage All original exact worker-file and Go source-tree membership assertions remain.
 */
export const test_transformer_records_linked_inputs_in_the_worker_snapshot =
  async () => {
    await assertTransformerRecordsLinkedInput();
  };
