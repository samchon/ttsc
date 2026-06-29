/** The required next step from a compiler-derived graph result. */
export interface ITtscGraphNext {
  /**
   * Answer, continue graph inspection, leave graph, or clarify.
   *
   * `answer` means the returned graph result already carries the evidence
   * contract for the current question. Do not call graph again or read files to
   * re-check it.
   */
  action: "answer" | "inspect" | "outside" | "clarify";

  /** Smallest graph request type to use when `action` is `inspect`. */
  request?:
    | "entrypoints"
    | "lookup"
    | "trace"
    | "details"
    | "overview"
    | "tour";

  /** Why the returned graph evidence supports that action. */
  reason: string;
}
