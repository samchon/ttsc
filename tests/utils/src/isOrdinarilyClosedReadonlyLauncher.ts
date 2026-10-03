/**
 * Classify only an actual synchronous launcher's ordinary termination metadata.
 * A complete-looking receipt permits the owning readonly flow to consider its
 * next transition; signals, launch errors, missing status and invalid process
 * identities withhold that authority. Nonzero ordinary application exits are
 * still completed requests, so the owning literal status assertions decide
 * whether their behavior succeeded.
 *
 * This pure decision neither queries kernel liveness nor certifies descendant
 * closure, permissions, compiler output or input stability. The native owner
 * must establish those separate boundaries before cleanup or graph mutation.
 *
 * @evidence contracts/common.md#principled-implementation Error-free non-null status, absent signal and positive integer PID distinguish usable ordinary launcher metadata from uncertainty; application status 1 or 2 does not manufacture an unresolved request.
 * @evidence contracts/common.md#clear-and-simple-design One pure predicate owns the exact receipt classification used by the actual readonly launcher before its next request or input transition.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts It reads supplied metadata without replacing TestProject.spawn, fabricating process execution, querying private runtime state or claiming descendant joins from a PID.
 * @evidence contracts/common.md#meaningful-documentation States the classification authority and explicitly separates kernel/process descendants, permission restoration and actual compiler behavior.
 * @evidence contracts/testing.md#behavioral-verification The direct source unit calls this actual exported predicate for twelve independently authored ordinary, error, signal and invalid-identity tuples; the private launcher uses the same operation for its actual result.
 * @evidence contracts/testing.md#independent-expectations Literal booleans specify the expected authority of each tuple independently of this predicate; no expected value is derived from a native result or the implementation.
 * @evidence contracts/testing.md#distinguishing-cases Statuses 0, 2 and 1 contrast with null status, signal presence, error presence, zero/negative/noninteger/infinite PIDs and error despite a normal status.
 * @evidence contracts/testing.md#execution-ownership test_readonly_launcher_receipt_classification_preserves_ordinary_and_unknown_termination directly imports and exercises this source operation; it allocates no project or child and substitutes no process API.
 * @evidenceExclude contracts/e2e.md#necessary-boundary The predicate's metadata decision needs no native compiler, ACL, launcher or kernel transport and cannot certify those boundaries.
 * @evidenceExclude contracts/e2e.md#shared-execution No expensive native producer or execution exists in this pure decision; ordinary and uncertain literal tuples run in one direct source unit.
 * @evidenceExclude contracts/e2e.md#state-isolation-and-reuse-validity It mutates no process environment, filesystem, process binding, cache or retained fixture state; the actual launcher owns those separate lifetimes.
 * @evidenceExclude contracts/e2e.md#preserved-coverage This source unit verifies classification only; the readonly native corpus retains its three actual requests, permission refusal/restoration probes and original literal output assertions.
 */
export function isOrdinarilyClosedReadonlyLauncher(receipt: {
  error?: Error;
  status: number | null;
  signal: NodeJS.Signals | null;
  pid: number;
}): boolean {
  return (
    receipt.error === undefined &&
    receipt.status !== null &&
    receipt.signal === null &&
    Number.isInteger(receipt.pid) &&
    receipt.pid > 0
  );
}
