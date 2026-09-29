/**
 * Build the fixed cmd.exe switch sequence for one already quoted payload.
 *
 * `/d` disables AutoRun, `/v:off` prevents delayed expansion and `/s /c` run
 * the prequoted command payload without another shell layer.
 *
 * @evidence contracts/common.md#principled-implementation The fixed cmd switches preserve the caller's one-pass quoted payload while disabling ambient AutoRun and delayed expansion.
 * @evidence contracts/common.md#clear-and-simple-design One argument builder separates shell switches from the shim's payload construction and actual spawning.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts These constants are cmd's documented invocation switches, not arguments chosen to bypass a consumer-specific failure.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains each switch's reason and the already-quoted payload premise.
 * @evidence contracts/portability.md#os-neutral-implementation This is the isolated Windows wrapper argv boundary; ordinary native executables and POSIX Go tools use direct argv spawning instead.
 *
 * @evidenceExclude contracts/performance.md#efficient-algorithms A fixed five-element argv has no input-dependent processing strategy beyond carrying the supplied payload.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Argument construction has no completed or in-flight computation to coordinate.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The caller owns spawning; this returns argv without acquiring a process or handle.
 */
export function windowsGoCommandArgs(payload: string): string[] {
  return ["/d", "/v:off", "/s", "/c", payload];
}
