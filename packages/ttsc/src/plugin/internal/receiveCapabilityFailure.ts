import { restoreCompilerError } from "../../internal/restoreCompilerError";

/**
 * Receive a worker failure while preserving separately reported ownership loss.
 *
 * Only the worker's task-local cleanup ledger and original retirement promises
 * authorize ownershipFailed. Ordinary discovery errors reject their caller but
 * do not poison terminal cleanup. A marked failure remains in the parent's
 * shutdown ledger even when that caller was already cancelled or ignores it.
 *
 * @evidence contracts/common.md#principled-implementation The worker's explicit ownership classification is retained independently of request rejection; ordinary discovery failure and native/resource cleanup failure remain distinct.
 * @evidence contracts/common.md#clear-and-simple-design One receiver restores the existing serialized error representation and transfers marked failures to the supplied owner ledger before returning the same error.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Error names and message text do not guess cleanup status; a cleanup error named AbortError still retains failure authority.
 * @evidence contracts/common.md#meaningful-documentation Native prose identifies the worker's classification authority and the parent shutdown consequence, including already cancelled callers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation This receiver handles structured worker messages and original error data without native process or filesystem operations.
 * @evidence contracts/performance.md#efficient-algorithms Error restoration follows the serialized aggregate tree and property bytes; one marked result invokes one retention callback, whose cost belongs to its owner.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each worker reply is independent failure evidence rather than a reusable discovery result.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Returned and retained references identify the same restored error; the parent owns its shutdown ledger lifetime, and this receiver acquires no native resource.
 */
export function receiveCapabilityFailure(
  reply: { thrown?: unknown; ownershipFailed?: boolean },
  retain: (error: Error) => void,
): Error {
  const error = restoreCompilerError(reply.thrown);
  if (reply.ownershipFailed === true) retain(error);
  return error;
}
