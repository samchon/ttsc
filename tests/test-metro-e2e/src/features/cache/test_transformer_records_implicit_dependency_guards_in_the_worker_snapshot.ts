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
 * 4. Recorder-only topology and config transitions execute in the named source
 *    unit test_recorder_guards_implicit_dependency_transitions.
 *
 * @evidence contracts/testing.md#behavioral-verification Native reporter metadata records exactly external/project descriptor inputs, retains its Go source tree, taints first unknown discovery, then stabilizes the unchanged next compiler run.
 * @evidence contracts/testing.md#independent-expectations The authored dependency list and exact expected fixture paths independently specify which inputs are outside static coverage; taint/epoch relationships follow run-baseline safety.
 * @evidence contracts/testing.md#distinguishing-cases Static in-walk dependencies contrast newly discovered external inputs and a subsequent unchanged proven run.
 * @evidence contracts/testing.md#execution-ownership This named features export test_transformer_records_implicit_dependency_guards_in_the_worker_snapshot executes the compiled Metro package in the E2E runner; source units own its portable decisions and the leaf helper retains this case assertions.
 * @evidence contracts/e2e.md#necessary-boundary Actual native dependency facts and generation witnesses must reach Metro through the adapter callback; direct recorder calls cannot certify compiler extraction.
 * @evidence contracts/e2e.md#shared-execution Both compiler observations share one project, reporter source and suite native producer cache; the second generation checks that newly compacted discovery can reuse its static coverage. Recorder-only cases were transferred out of this native population.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Worker run IDs come from actual preparation and key baselines precede transforms. Only the case own snapshot progresses; options restore after each worker and tracked directories end with runner cleanup.
 * @evidence contracts/e2e.md#preserved-coverage Original exact input set, source-tree, first taint and stabilized epoch assertions remain. test_recorder_guards_implicit_dependency_transitions now owns every ancestor, ABA, alias-swap, selection and malformed-baseline assertion from the former tail.
 */
export const test_transformer_records_implicit_dependency_guards_in_the_worker_snapshot =
  async () => {
    await assertTransformerRecordsImplicitDependencyGuards();
  };
