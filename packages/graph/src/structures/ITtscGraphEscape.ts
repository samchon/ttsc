import { ITtscGraphNext } from "./ITtscGraphNext";

/** The no-op result for when graph is not the useful next evidence source. */
export interface ITtscGraphEscape {
  /** Discriminator for the no-op escape route. */
  type: "escape";

  /** Always true so callers can distinguish an intentional no-op. */
  skipped: true;

  /** Why no graph operation should run. */
  reason: string;

  /** How to proceed after skipping graph work. */
  next: ITtscGraphNext;

  /** Human-readable compatibility note mirroring `next`. */
  guide: string;

  /** Optional note about the next non-graph step. */
  nextStep?: string;
}

export namespace ITtscGraphEscape {
  /** Skip graph work when graph evidence is unnecessary or exhausted. */
  export interface IRequest {
    /** Discriminator for the no-op escape route. */
    type: "escape";

    /**
     * Why no graph operation should run.
     *
     * Use this only when the next evidence is outside the indexed TypeScript
     * graph: package scripts, config files, generated output, prose docs, exact
     * text, or exact source body text. Name the smallest returned sourceSpan
     * when source body text is truly required.
     */
    reason: string;

    /**
     * The final non-graph note, if useful.
     *
     * Keep this short. Examples: `answer from the prior graph result`, `source
     * body needed at returned sourceSpan`, or `ask the user for a concrete
     * symbol`.
     */
    nextStep?: string;
  }
}
