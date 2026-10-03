import { case_evidence_positive_watch_consumers_share_one_watcher } from "./evidence/scenes/case_evidence_positive_watch_consumers_share_one_watcher";

/**
 * Executes the live-loader watch profile of the Native lifecycle family.
 * Its live producer and detached private loader revocation are incompatible
 * with the immutable snapshot dependency owner used by the consumer family.
 *
 * 1. Prepare the original live producer and watcher once.
 * 2. Run its named absent/created, stale/recovered and parser-control phases.
 * 3. Close the watcher and retain failures under their original phase names.
 *
 * @evidence contracts/testing.md#behavioral-verification The actual positive-watch owner retains its thirteen mutation/diagnostic cycles and cold comparison; this entry introduces no alternate expected status.
 * @evidence contracts/testing.md#independent-expectations Authored source/Markdown/Swagger literals and exact findings remain in the existing callbacks; load telemetry is not Program-object identity.
 * @evidence contracts/testing.md#distinguishing-cases Initial absence, real creation/removal, documented/review recovery and destructive loader revocation retain different watcher phases and original controls.
 * @evidence contracts/testing.md#execution-ownership The explicit consolidated Native lifecycle entry selects this real shared watcher batch; legacy Evidence entry still includes it unless a prepared immutable consumer expressly excludes it.
 * @evidence contracts/e2e.md#necessary-boundary Actual filesystem notifications, native resident cycles and Node parser-loader revocation cannot be replaced by supplied callback results.
 * @evidence contracts/e2e.md#shared-execution One existing watcher and producer serve thirteen phases; the original independent cold comparison remains an additional request, not a reused Program or hidden installation.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity This owner preserves the original live producer rather than borrowing snapshot modules, orders revocation last and delegates exact byte restoration, close and unknown-reader retention to its actual batch.
 * @evidence contracts/e2e.md#preserved-coverage All original positive-watch callback literals and failure identities remain. Additional approved Native lifecycle profiles are not claimed as implemented here, and actual survivor execution remains remote validation work.
 */
export async function test_e2e_native(): Promise<void> {
  await case_evidence_positive_watch_consumers_share_one_watcher();
}
