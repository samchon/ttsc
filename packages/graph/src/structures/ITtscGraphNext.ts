/** The required next step from a compiler-derived graph result. */
export interface ITtscGraphNext {
  /**
   * Answer, keep inspecting, leave graph, or clarify. `answer` means the result
   * already carries the evidence for the question, even when capped: do not
   * call graph again or read files to re-check or complete it.
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
