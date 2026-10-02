import { ITtscGraphEvidence } from "./ITtscGraphEvidence";
import { TtscGraphEdgeKind } from "./TtscGraphEdgeKind";

/**
 * A directed relationship between two {@link ITtscGraphNode}s, both named by
 * `id`. The triple `(from, to, kind)` is unique; a repeat keeps the first
 * source-order evidence. Every edge between declarations is compiler-resolved,
 * apart from the `contains` ownership the memory layer derives and the
 * trace-only `dispatches` hop, and an artifact node's `contains` parent is the
 * one its publishing plugin named. There is no per-edge trust flag: `kind` says
 * which of these an edge is.
 *
 * @evidence contracts/common.md#principled-implementation Directed endpoint identities and a relation kind express a resolved edge; optional evidence supplies coordinates without changing identity.
 * @evidence contracts/common.md#clear-and-simple-design One record separates relation identity from its source span, with no duplicated node payload.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Relation kinds come from the shared vocabulary rather than fixture-specific relationships.
 * @evidence contracts/common.md#meaningful-documentation Native documentation states edge uniqueness and first-source evidence semantics; member comments are visibly separated.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources ITtscGraphEdge declares a data shape or groups members and owns no handle, task or retained state.
 * @evidenceExclude contracts/performance.md#efficient-algorithms ITtscGraphEdge declares a data shape or groups members and chooses no algorithm.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work ITtscGraphEdge declares a data shape or groups members and coordinates no computation across requests.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation ITtscGraphEdge declares a data shape or groups members and performs no filesystem, path or process operation.
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
