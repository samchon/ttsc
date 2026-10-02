import type { TtscFailedGenerationValidation } from "../generation/TtscFailedGenerationValidation";
import { TtscTerminalGenerationError } from "./TtscTerminalGenerationError";

/**
 * A bounded proof failure that stays authoritative until its inputs change.
 *
 * This is the adapter failing to _obtain_ a coherent snapshot — a race it lost
 * — so a later attempt may well succeed with the same inputs. It is retried
 * when its recorded environment moves, and a new delivery epoch grants it the
 * one fresh attempt the per-pass cache clear used to give it
 * (samchon/ttsc#1300).
 *
 * @evidence contracts/common.md#principled-implementation The error carries the captured failed environment so consumers can replay only while that environment and delivery epoch remain unchanged, rather than treating a lost snapshot race as permanent compiler failure.
 * @evidence contracts/common.md#clear-and-simple-design One validation field extends the shared terminal category; retry decisions stay with generation validation and the cache.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Retryability is tied to observed inputs instead of fabricated output, unbounded retries or matching a known race message.
 * @evidence contracts/common.md#meaningful-documentation The native comment explains the acquisition failure and its retry boundary, while the field comment identifies what permits a new attempt.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation
 *   An error class that carries a message and fields only; it touches no
 *   filesystem, path or process.
 * @evidenceExclude contracts/performance.md#efficient-algorithms
 *   The constructor assigns its fields; constant work.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   Computes nothing that could be reused.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   Retains only the message, cause and fields given to the constructor,
 *   released with the error.
 */
export class TtscUnstableGenerationError extends TtscTerminalGenerationError {
  /**
   * The recorded environment the verdict was proven against; a change to it
   * permits a retry.
   */
  public readonly validation: TtscFailedGenerationValidation;

  public constructor(
    message: string,
    validation: TtscFailedGenerationValidation,
  ) {
    super(message);
    this.name = "TtscUnstableGenerationError";
    this.validation = validation;
  }
}
