/**
 * What to do with a compiler-derived graph result.
 *
 * @evidence contracts/common.md#principled-implementation The action union represents the supported next decisions, with request identifying the operation for inspect.
 * @evidence contracts/common.md#clear-and-simple-design Action, optional request and reason separate control choice from its explanation in one small record.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts This vocabulary carries a result decision without encoding agent-specific control hacks.
 * @evidence contracts/common.md#meaningful-documentation The action comment describes each decision and the inspect request's conditional meaning using native member documentation.
 */
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
