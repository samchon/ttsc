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
 */
export class TtscUnstableGenerationError extends TtscTerminalGenerationError {
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
