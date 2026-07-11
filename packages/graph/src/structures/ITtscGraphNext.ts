/** What to do with a compiler-derived graph result. */
export interface ITtscGraphNext {
  /**
   * What to do with this result:
   *
   * - `answer`: the result carries the evidence; stop and answer, do not call
   *   graph again or read files to re-check it
   * - `inspect`: the result is genuinely partial; make exactly the one `request`
   *   named, once
   * - `outside`: the answer is outside the graph; escape and read source
   * - `clarify`: the request was malformed or ambiguous; restate it
   */
  action: "answer" | "inspect" | "outside" | "clarify";

  /** The single graph request type to use when `action` is `inspect`. */
  request?:
    | "entrypoints"
    | "lookup"
    | "trace"
    | "details"
    | "overview"
    | "tour";

  /** Why the returned evidence supports that action. */
  reason: string;
}
