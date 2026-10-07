import { unwritableContract } from "../unwritable.mjs";

/**
 * Verifies real hosts preserve correctness when the project record directory is unwritable.
 *
 * @evidence contracts/testing.md#behavioral-verification
 *   unwritableContract creates a file at .ttsc/records. Webpack executes persisted-cache restarts; Farm executes FIRST then offline SECOND with actual fallback or cache-disable refusal; Turbopack must fail naming cannot be written.
 * @evidence contracts/testing.md#independent-expectations
 *   A file cannot be a record directory on supported filesystems. FIRST/SECOND are fixture inputs; Turbopack cannot accept a record outside its root and must refuse unsafe delivery.
 * @evidence contracts/testing.md#distinguishing-cases
 *   Covers webpack temporary fallback, Farm same-drive fallback versus cross-drive cache-disable behavior, and Turbopack refusal. It does not reinterpret a missing record as safe cache adoption.
 * @evidence contracts/testing.md#execution-ownership
 *   The worker calls this named entry for webpack, Farm and next-turbopack only. The persistent-cache named entry owns webpack assertions; restart-cycle owns Farm refusal/value checks and Turbopack error matching.
 * @evidence contracts/e2e.md#necessary-boundary
 *   Host cache stores and accepted record locations differ. Source path calculations cannot certify actual Farm refusal, webpack restoration or Turbopack rejected development delivery.
 * @evidence contracts/e2e.md#shared-execution
 *   Reuses the packed install and linked producer. Webpack uses its existing five restart lifetimes, Farm two and Turbopack one; offline and cross-process behavior requires these minimal independent sessions.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity
 *   The fixture is separate from writable-cache tests. Only records is blocked, so compile logs remain writable and cannot create a false producer failure. restartCycle owns and closes every actual host process.
 * @evidence contracts/e2e.md#preserved-coverage
 *   Retains original webpack cache-adoption/edit assertions, both Farm values and refusedWithoutRecords checks, and Turbopack infrastructure-error assertion. No writable fixture or warmed record masks the blocked-directory transition.
 */
export async function test_host_unwritable_record_directory(host) {
  await unwritableContract(host);
}
