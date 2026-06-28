/** The no-op graph result returned when reasoning rejects the graph call. */
export interface ITtscGraphEscape {
  /** Discriminator for the no-op escape route. */
  type: "escape";

  /** Always true so callers can distinguish an intentional no-op. */
  skipped: true;

  /** Why no graph operation should run. */
  reason: string;

  /** The next non-graph step, if useful. */
  nextStep?: string;
}

export namespace ITtscGraphEscape {
  /** Exit after the reasoning review decides graph evidence is unnecessary. */
  export interface IRequest {
    /** Discriminator for the no-op escape route. */
    type: "escape";

    /**
     * Why no graph operation should run.
     *
     * Use this when the review finds the user is asking about package scripts,
     * config files, generated output, prose documentation, or an answer that
     * the current graph result already settled.
     */
    reason: string;

    /**
     * The next non-graph step, if useful.
     *
     * Keep this short. Examples: `answer from the prior graph result`, `inspect
     * package.json`, or `ask the user for a concrete symbol`.
     */
    nextStep?: string;
  }
}
