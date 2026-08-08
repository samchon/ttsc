import type { EvidenceBenchmarkArm } from "../typings/EvidenceBenchmarkArm";

/**
 * One measured reference edge of the provenance graph.
 *
 * The population is the source artifacts an edge may be asked of, and the
 * reached count is how many of them arrive at the target. Both are retained
 * rather than the ratio alone, because a rate over ten hooks and a rate over
 * five hundred accessors carry the same weight in an unweighted branch mean and
 * the composed figure cannot say so afterwards.
 */
export interface ITtscEvidenceBenchmarkCoverageEdge {
  /** Source artifacts this edge is measured over. */
  eligible: number;

  /** Source artifacts that reach the edge's target. */
  reached: number;
}

/**
 * The thirteen measured edges of one Plain codebase.
 *
 * The names follow the graph rather than the rule set: an accessor is the
 * published operation an SDK exposes, and a column is the model field a DTO
 * property has to carry. Each edge is measured independently, and each appears
 * exactly once in the composition — an edge counted twice penalises its
 * subgraph twice, and an edge left out hides the whole failure class below it.
 */
export interface ITtscEvidenceBenchmarkCoverageMeasurement {
  requirementToModel: ITtscEvidenceBenchmarkCoverageEdge;
  requirementToOperation: ITtscEvidenceBenchmarkCoverageEdge;
  requirementToDto: ITtscEvidenceBenchmarkCoverageEdge;
  requirementToTest: ITtscEvidenceBenchmarkCoverageEdge;
  requirementToScreen: ITtscEvidenceBenchmarkCoverageEdge;
  requirementToJourney: ITtscEvidenceBenchmarkCoverageEdge;
  modelToOperation: ITtscEvidenceBenchmarkCoverageEdge;
  modelToDto: ITtscEvidenceBenchmarkCoverageEdge;
  accessorToTest: ITtscEvidenceBenchmarkCoverageEdge;
  accessorToHook: ITtscEvidenceBenchmarkCoverageEdge;
  hookToScreen: ITtscEvidenceBenchmarkCoverageEdge;
  screenToJourney: ITtscEvidenceBenchmarkCoverageEdge;
  columnToProperty: ITtscEvidenceBenchmarkCoverageEdge;
}

/** Name of a measured edge, as the composition reports it. */
export type EvidenceBenchmarkCoverageEdgeName =
  keyof ITtscEvidenceBenchmarkCoverageMeasurement;

/** One measured edge as the composition reports it back. */
export interface ITtscEvidenceBenchmarkCoverageEdgeReport extends ITtscEvidenceBenchmarkCoverageEdge {
  name: EvidenceBenchmarkCoverageEdgeName;

  /**
   * `reached / eligible`, or `null` over an empty population.
   *
   * An edge no source artifact is eligible for demands nothing, so it cannot
   * report satisfaction. Scoring it as one is the failure the measurement
   * integrity rules name directly: a claim that reaches an empty population
   * reports full coverage while checking nothing.
   */
  rate: number | null;
}

/**
 * How whole each artifact kind is below itself.
 *
 * A leaf owes nothing downstream and is one. Everything above it folds from the
 * leaves up, multiplying along a chain and averaging across branches. `null` is
 * a kind whose every downstream edge was unmeasurable, which is distinct from
 * zero: zero is a measured total failure, `null` is an absent question.
 */
export interface ITtscEvidenceBenchmarkCoverageWholeness {
  test: number;
  journey: number;
  property: number;
  dto: number | null;
  screen: number | null;
  hook: number | null;
  api: number | null;
  model: number | null;
}

/** One of the six obligations a requirement anchor carries. */
export interface ITtscEvidenceBenchmarkCoverageObligation {
  name: "model" | "operation" | "dto" | "test" | "screen" | "journey";

  /** The requirement-rooted edge this obligation is measured by. */
  edge: EvidenceBenchmarkCoverageEdgeName;

  /** That edge's own rate. */
  rate: number | null;

  /** Wholeness of what the edge reaches. */
  wholeness: number | null;

  /** `rate × wholeness`, the obligation's contribution to the score. */
  value: number | null;
}

/**
 * Composed provenance-graph coverage of one measured cell.
 *
 * The score answers how much of the reference graph a codebase satisfies. It is
 * not an average of the edge rates and it is not their product: averaging
 * ignores structure and lets a healthy near end conceal a broken far end, while
 * multiplying treats branches as a chain and collapses toward zero because
 * branch failures are correlated rather than independent. Serial hops multiply
 * because reaching the far end requires every hop; branches average because
 * each carries its own obligation and its own value.
 */
export interface ITtscEvidenceBenchmarkCoverage {
  arm: EvidenceBenchmarkArm;

  /**
   * Whether this figure came from measuring a codebase.
   *
   * False for Evidence, whose plugin enforces every edge as a build gate. A
   * green Evidence cell satisfies the graph by construction, so its score is
   * one by definition and no analysis of it would be measuring anything the
   * compiler had not already refused to emit without.
   */
  measured: boolean;

  /**
   * The composed figure, or `null` when no obligation was measurable.
   *
   * A codebase with no requirement anchors at all produces `null` rather than
   * zero or one, because it was never asked the question.
   */
  score: number | null;

  wholeness: ITtscEvidenceBenchmarkCoverageWholeness;

  /** The six requirement obligations, in graph order. */
  obligations: ITtscEvidenceBenchmarkCoverageObligation[];

  /** Every measured edge, echoed with its rate. */
  edges: ITtscEvidenceBenchmarkCoverageEdgeReport[];
}
