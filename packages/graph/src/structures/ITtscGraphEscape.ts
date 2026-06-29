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
     * Use this when the review finds the user is asking about package scripts,
     * config files, generated output, prose documentation, exact text, or an
     * answer that the current graph result already settled. When source text is
     * required, name the smallest returned sourceSpan so follow-up work can be
     * targeted instead of broad.
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
