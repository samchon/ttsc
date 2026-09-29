import { BootTtscWorkerTerminationError } from "@ttsc/wasm";

/**
 * Owner callbacks for replacing a Worker whose Go runtime cannot be restarted.
 *
 * @evidence contracts/common.md#principled-implementation Claim, reset and failure publication express the ordered ownership transition while leaving actual Worker identity with the client.
 * @evidence contracts/common.md#clear-and-simple-design The adapter exposes only the three effects recovery needs, independently of React state.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Recovery is limited to terminal runtime identity rather than a universal retry wrapper around ordinary failures.
 * @evidence contracts/common.md#meaningful-documentation Native prose states terminal scope and member ownership, with documentation-skill member spacing.
 */
export interface ITerminalCompilerWorkerRecovery {
  /**
   * Atomically claim and fence the failed Worker generation.
   *
   * @evidence contracts/common.md#principled-implementation A boolean reports whether this caller obtained replacement ownership before asynchronous disposal.
   * @evidence contracts/common.md#clear-and-simple-design The client retains generation state while recovery consumes a narrow claim decision.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Stale claimants cannot reset another caller's replacement.
   * @evidence contracts/common.md#meaningful-documentation Native prose defines atomic claim and fencing with tag separation under the documentation skill.
   */
  claim(): boolean;

  /**
   * Close and clear the claimed Worker generation before failure publication.
   *
   * @evidence contracts/common.md#principled-implementation The promise marks the asynchronous disposal boundary for the claimed owner.
   * @evidence contracts/common.md#clear-and-simple-design Disposal remains the client's responsibility rather than being recreated in the recovery helper.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Disposal uses the supported client boundary instead of replacing runtime internals.
   * @evidence contracts/common.md#meaningful-documentation Native prose states ownership and ordering with tag separation under the documentation skill.
   */
  reset(): Promise<void>;

  /**
   * Publish the terminal error after reset settles, even if reset rejects.
   *
   * @evidence contracts/common.md#principled-implementation Publication preserves the actual terminal error independently of whether disposal succeeded.
   * @evidence contracts/common.md#clear-and-simple-design State presentation remains with the owner callback, separated from error classification.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Disposal failure does not erase the deciding runtime failure or invent readiness.
   * @evidence contracts/common.md#meaningful-documentation Native prose states finally-path behavior with tag separation under the documentation skill.
   */
  fail(error: unknown): void;
}

/**
 * Replace a compiler Worker after its Go runtime started but boot never became
 * usable. Returns false for ordinary compile, transport, and plugin failures.
 *
 * @evidence contracts/common.md#principled-implementation Stable terminal-error classification gates an atomic claim; reset is awaited and original failure publication runs in finally so terminal state is never replaced by ordinary retry.
 * @evidence contracts/common.md#clear-and-simple-design Classification, ownership and reset effects have separate boundaries, keeping this coordinator independent of UI state.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Only the runtime's explicit terminal identity triggers replacement; ordinary failures do not accumulate reset-and-retry compensation.
 * @evidence contracts/common.md#meaningful-documentation Native prose states terminal scope and false return meaning; callback prose defines reset rejection behavior under the documentation skill.
 */
export async function recoverTerminalCompilerWorker(
  error: unknown,
  recovery: ITerminalCompilerWorkerRecovery,
): Promise<boolean> {
  if (!requiresCompilerWorkerReplacement(error)) return false;
  if (!recovery.claim()) return true;
  try {
    await recovery.reset();
  } finally {
    recovery.fail(error);
  }
  return true;
}

/**
 * Recognize the terminal runtime's stable code or message prefix after transport.
 *
 * @evidence contracts/common.md#principled-implementation The host-owned code matches both enumerable error records and prefixed string messages without relying on cross-realm instanceof.
 * @evidence contracts/common.md#clear-and-simple-design One classifier centralizes local and transported identity for every recovery caller.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Classification uses a supported error identity rather than arbitrary message fragments or consumer names.
 * @evidence contracts/common.md#meaningful-documentation Native prose states the stable transport witness with tag separation under the documentation skill.
 */
export function requiresCompilerWorkerReplacement(error: unknown): boolean {
  const code = BootTtscWorkerTerminationError.CODE;
  const prefix = `[${code}] `;
  if (typeof error === "string") return error.startsWith(prefix);
  if (!error || typeof error !== "object") return false;
  const record = error as { code?: unknown; message?: unknown };
  return (
    record.code === code ||
    (typeof record.message === "string" && record.message.startsWith(prefix))
  );
}
