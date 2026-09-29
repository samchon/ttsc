/**
 * Whether a spawn error reports EBADF, including message-only native errors.
 *
 * The caller decides whether its platform and stdio mode permit a descriptor
 * retry; EBADF alone does not prove that every failure was descriptor height.
 *
 * @evidence contracts/common.md#principled-implementation The code or message reports the native EBADF class; this predicate does not pretend to diagnose the descriptor's exact failure mechanism.
 * @evidence contracts/common.md#clear-and-simple-design Error classification is separate from the caller's platform gate and broker selection, so one predicate serves both launch owners.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Message matching supports native errors without a code property; it does not replace foreign errors or convert command failure into success.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs state both the accepted error representations and the limitation of EBADF as a cause diagnosis, with a separate tag block.
 */
export function isSpawnSyncFdExhaustion(error: Error | undefined): boolean {
  const code = (error as NodeJS.ErrnoException | undefined)?.code;
  return code === "EBADF" || error?.message.includes("EBADF") === true;
}
