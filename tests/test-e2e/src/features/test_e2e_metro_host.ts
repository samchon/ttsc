import { test_e2e_metro } from "./test_e2e_metro";

/**
 * Verifies Metro transforms and concurrent snapshots through one prepared owner.
 *
 * The existing Metro workspace supplies its generated template and cold slots
 * to all adapter profiles. Its final profile uses the same built fingerprint
 * module in two real processes without installing a second consumer.
 *
 * 1. Execute the original named transform, cache and session matrix.
 * 2. Use a cold bare slot for all 150 concurrent compaction rounds.
 * 3. Join the compactor before the workspace's existing cleanup.
 *
 * @evidence contracts/testing.md#behavioral-verification Existing sixteen profiles keep their assertions; the final concurrent profile preserves progress-before-read, undefined fail-closed, lost[], exit0, done150 and final trusted membership for every authored input.
 * @evidence contracts/testing.md#independent-expectations Literal150, input-N.d.ts paths, ready/done nonce and original transform/output/key markers are independently authored. A nonproductive empty snapshot cannot satisfy final membership.
 * @evidence contracts/testing.md#distinguishing-cases Defined snapshots retain all earlier completed inputs while undefined race reads may fail closed. Failed admission, signal, child error, deadline and cancellation remain failures, rather than successful skipped rounds.
 * @evidence contracts/testing.md#execution-ownership The explicit consolidated Metro entry enables the existing shared workspace owner's final concurrent scene. Default legacy Metro calls retain their original sixteen-profile selection; this callable is authored and actual selected execution remains unverified.
 * @evidence contracts/e2e.md#necessary-boundary Actual native transforms and two process views of snapshot publication/compaction need their real connections; direct policy units do not reproduce those process views.
 * @evidence contracts/e2e.md#shared-execution One existing generated template and prepared package module serve all profiles. The concurrent scene allocates cold slots inside that owner and one necessary compactor child, with no extra installation or native build; actual process and Program totals remain measured separately.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Original slot replacement resets snapshot epochs. The final scene owns its readiness/progress/done files and joins child close before workspace cleanup; copied state is not reused as a verdict, and arbitrary descendants remain outside that close observation.
 * @evidence contracts/e2e.md#preserved-coverage Original Metro sixteen-profile order and literals remain in their owning bodies; the original test-metro concurrent donor remains until actual executed survival and coverage establish removal eligibility. Registration is not runtime success or complete family coverage.
 */
export async function test_e2e_metro_host(): Promise<void> {
  await test_e2e_metro(true);
}
