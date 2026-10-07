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
 * @evidence contracts/portability.md#os-neutral-implementation The supplied Node receipt keeps signal, error, nullable status and PID separate; the predicate does not infer kernel liveness or platform permissions.
 * @evidence contracts/performance.md#efficient-algorithms A fixed number of primitive metadata comparisons use constant time and space.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each current receipt is classified independently; no result is reused as closure proof.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The pure predicate acquires no native handle, task or retained state.
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
