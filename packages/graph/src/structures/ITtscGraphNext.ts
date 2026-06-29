/** The next action supported by a compiler-derived graph result. */
export interface ITtscGraphNext {
  /** Answer, continue graph inspection, leave graph, or clarify. */
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
