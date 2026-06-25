import { Confidence } from "./Confidence";
import { EdgeKind } from "./EdgeKind";
import { IEvidence } from "./IEvidence";
import { Provenance } from "./Provenance";

/**
 * A directed relationship from one {@link IGraphNode} to another, both named by
 * `id`. The triple `(from, to, kind)` is unique; a repeated relationship keeps
 * the first source-order evidence.
 *
 * `provenance` and `confidence` are mandatory so every edge declares how it was
 * derived: a `calls` edge the checker resolved is `checker-resolved`/`high`; a
 * `handles_route` edge a framework pass synthesized is
 * `framework-derived`/`medium`; an opt-in callback bridge is
 * `heuristic`/`low`.
 */
export interface IGraphEdge {
  /** Node id the relationship originates from. */
  from: string;

  /** Node id the relationship points to. */
  to: string;

  /** The relationship kind. */
  kind: EdgeKind;

  /** How the edge was derived. */
  provenance: Provenance;

  /** How much to trust the edge. */
  confidence: Confidence;

  /** The source expression that produced the edge, for display and expansion. */
  evidence?: IEvidence;
}
