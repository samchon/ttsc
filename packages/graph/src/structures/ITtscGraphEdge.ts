import { ITtscGraphEvidence } from "./ITtscGraphEvidence";
import { TtscGraphEdgeKind } from "./TtscGraphEdgeKind";

/**
 * A directed relationship between two {@link ITtscGraphNode}s, both named by
 * `id`. The triple `(from, to, kind)` is unique; a repeat keeps the first
 * source-order evidence. Every edge is compiler-resolved, so there is no
 * per-edge trust flag: the whole graph is checker-resolved fact.
 *
 * @evidence contracts/common.md#principled-implementation Directed endpoint identities and a relation kind express a resolved edge; optional evidence supplies coordinates without changing identity.
 * @evidence contracts/common.md#clear-and-simple-design One record separates relation identity from its source span, with no duplicated node payload.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Relation kinds come from the shared vocabulary rather than fixture-specific relationships.
 * @evidence contracts/common.md#meaningful-documentation Native documentation states edge uniqueness and first-source evidence semantics; member comments are visibly separated.
 */
export interface ITtscGraphEdge {
  /** Node id the relationship originates from. */
  from: string;

  /** Node id the relationship points to. */
  to: string;

  /** The relationship kind. */
  kind: TtscGraphEdgeKind;

  /** The source expression that produced the edge, for display and expansion. */
  evidence?: ITtscGraphEvidence;
}
