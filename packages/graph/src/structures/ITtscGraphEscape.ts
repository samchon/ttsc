/**
 * The no-op result for when graph is not the useful next evidence source.
 *
 * @evidence contracts/common.md#principled-implementation Literal escape and skipped discriminators distinguish an intentional no-op from an empty graph answer.
 * @evidence contracts/common.md#clear-and-simple-design The reason and optional next step explain the no-op without carrying graph state.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Escape is an explicit caller choice, not a hidden suppression of legitimate graph requests.
 * @evidence contracts/common.md#meaningful-documentation Field comments explain the no-op and optional follow-up; prose and tags have a blank separator.
 */
export interface ITtscGraphEscape {
  /** Discriminator for the no-op escape route. */
  type: "escape";

  /** Always true so callers can distinguish an intentional no-op. */
  skipped: true;

  /** Why no graph operation should run. */
  reason: string;

  /** Optional note about the next non-graph step. */
  nextStep?: string;
}

export namespace ITtscGraphEscape {
  /**
   * Skip graph work when graph evidence is unnecessary or exhausted.
   *
   * @evidence contracts/common.md#principled-implementation The escape discriminator selects a no-op and requires the caller's reason rather than implying a graph finding.
   * @evidence contracts/common.md#clear-and-simple-design Only the reason and optional next step are needed for the escape boundary.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The branch provides a supported escape without caps, cooldowns or forced graph use.
   * @evidence contracts/common.md#meaningful-documentation Native comments identify non-graph evidence and explain when source spans justify reading a body.
   */
  export interface IRequest {
    /** Discriminator for the no-op escape route. */
    type: "escape";

    /**
     * Why no graph operation should run. Use only when the next evidence is
     * outside the indexed graph: package scripts, config files, generated
     * output, prose docs, exact text, or source body text. Name the smallest
     * returned sourceSpan when source body text is truly required.
     */
    reason: string;

    /**
     * A short final non-graph note, if useful, for example `answer from the
     * prior graph result` or `source body needed at returned sourceSpan`.
     */
    nextStep?: string;
  }
}
