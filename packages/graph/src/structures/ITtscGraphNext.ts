/** The next action a graph result is designed to support. */
export interface ITtscGraphNext {
  /** Whether to answer, continue graph inspection, leave graph, or clarify. */
  action: "answer" | "inspect" | "outside" | "clarify";

  /** Smallest graph request type to use when `action` is `inspect`. */
  request?:
    | "entrypoints"
    | "lookup"
    | "trace"
    | "details"
    | "overview"
    | "tour";

  /** Short reason for the action. */
  reason: string;
}
