import type {
  EvidenceBenchmarkCoverageEdgeName,
  ITtscEvidenceBenchmarkCoverage,
  ITtscEvidenceBenchmarkCoverageEdge,
  ITtscEvidenceBenchmarkCoverageEdgeReport,
  ITtscEvidenceBenchmarkCoverageMeasurement,
  ITtscEvidenceBenchmarkCoverageObligation,
  ITtscEvidenceBenchmarkCoverageWholeness,
} from "./structures/ITtscEvidenceBenchmarkCoverage";

/**
 * Composes a coverage figure over the evidence graph's thirteen edges.
 *
 * The arithmetic is the whole point of this module. Per-edge rates do not
 * compose by themselves; the composition needs the graph, and the graph has two
 * kinds of relationship that need different operators. Applying one operator
 * throughout produces a number that is either flattering or degenerate, and
 * both were observed on a real subject: averaging the thirteen rates scored it
 * 58.4% while 76 of its 557 published accessors had an asserting test, and
 * multiplying them scored it 0.003%, which reports nothing except that four
 * correlated fractions were multiplied.
 *
 * Only Plain is measured. Evidence is one by construction — see
 * {@link EvidenceBenchmarkCoverage.evidence}.
 */
export namespace EvidenceBenchmarkCoverage {
  /** Every measured edge, in the order the composition folds them. */
  export const EDGE_NAMES: readonly EvidenceBenchmarkCoverageEdgeName[] = [
    "columnToProperty",
    "screenToJourney",
    "hookToScreen",
    "accessorToTest",
    "accessorToHook",
    "modelToOperation",
    "modelToDto",
    "requirementToModel",
    "requirementToOperation",
    "requirementToDto",
    "requirementToTest",
    "requirementToScreen",
    "requirementToJourney",
  ];

  /**
   * The Evidence arm's coverage, asserted rather than measured.
   *
   * The plugin enforces every one of these edges as a build gate, so an
   * Evidence cell that compiles has already satisfied the graph. Measuring it
   * would either restate that or contradict the compiler, and neither is a
   * measurement. The arm is therefore recorded as complete with no analysis
   * behind it, and `measured` says so rather than leaving a reader to assume a
   * codebase was inspected.
   */
  export const evidence = (): ITtscEvidenceBenchmarkCoverage => ({
    arm: "evidence",
    measured: false,
    score: 1,
    wholeness: {
      test: 1,
      journey: 1,
      property: 1,
      dto: 1,
      screen: 1,
      hook: 1,
      api: 1,
      model: 1,
    },
    obligations: [],
    edges: [],
  });

  /** Composes one Plain codebase's measured edges into its score. */
  export const plain = (
    measurement: ITtscEvidenceBenchmarkCoverageMeasurement,
  ): ITtscEvidenceBenchmarkCoverage => {
    const edges: ITtscEvidenceBenchmarkCoverageEdgeReport[] = EDGE_NAMES.map(
      (name) => report(name, measurement[name]),
    );
    const of = (name: EvidenceBenchmarkCoverageEdgeName): number | null =>
      edges.find((edge) => edge.name === name)!.rate;

    const wholeness: ITtscEvidenceBenchmarkCoverageWholeness = {
      test: 1,
      journey: 1,
      property: 1,
      dto: of("columnToProperty"),
      screen: of("screenToJourney"),
      hook: null,
      api: null,
      model: null,
    };
    wholeness.hook = serial(of("hookToScreen"), wholeness.screen);
    wholeness.api = branch([
      serial(of("accessorToTest"), wholeness.test),
      serial(of("accessorToHook"), wholeness.hook),
    ]);
    wholeness.model = branch([
      serial(of("modelToOperation"), wholeness.api),
      serial(of("modelToDto"), wholeness.dto),
    ]);

    const obligations: ITtscEvidenceBenchmarkCoverageObligation[] = (
      [
        ["model", "requirementToModel", wholeness.model],
        ["operation", "requirementToOperation", wholeness.api],
        ["dto", "requirementToDto", wholeness.dto],
        ["test", "requirementToTest", wholeness.test],
        ["screen", "requirementToScreen", wholeness.screen],
        ["journey", "requirementToJourney", wholeness.journey],
      ] as const
    ).map(([name, edge, reachedWholeness]) => ({
      name,
      edge,
      rate: of(edge),
      wholeness: reachedWholeness,
      value: serial(of(edge), reachedWholeness),
    }));

    return {
      arm: "plain",
      measured: true,
      score: branch(obligations.map((obligation) => obligation.value)),
      wholeness,
      obligations,
      edges,
    };
  };

  /**
   * Multiplies along a chain.
   *
   * Reaching the far end of `A → B → C` requires both hops, so the rate of the
   * whole is the product. An unmeasurable factor propagates as unmeasurable
   * instead of as one: the chain's far end was never asked about, and treating
   * silence as satisfaction is what turns an empty population into a full
   * score.
   */
  const serial = (left: number | null, right: number | null): number | null =>
    left === null || right === null ? null : left * right;

  /**
   * Averages across branches.
   *
   * The product of two branch rates answers what share satisfies both, which
   * equals the product only when the two fail independently. They do not — a
   * requirement missing from the schema tends to be missing from the journeys
   * too — so the product understates by a factor that compounds per branch. The
   * mean assumes nothing about correlation, which is why it is used.
   *
   * It is unweighted, so a branch over five hundred accessors and a branch over
   * ten hooks count equally. Weighting by population or by declared importance
   * is defensible and would change the figures; there is no principled default
   * yet, so the populations are retained on every edge and the choice is left
   * where it can be argued rather than buried here.
   */
  const branch = (values: readonly (number | null)[]): number | null => {
    const measured: number[] = values.filter(
      (value): value is number => value !== null,
    );
    return measured.length === 0
      ? null
      : measured.reduce((sum, value) => sum + value, 0) / measured.length;
  };

  const report = (
    name: EvidenceBenchmarkCoverageEdgeName,
    edge: ITtscEvidenceBenchmarkCoverageEdge | undefined,
  ): ITtscEvidenceBenchmarkCoverageEdgeReport => {
    if (edge === undefined)
      throw new Error(
        `Coverage edge \`${name}\` is missing. Every one of the ${EDGE_NAMES.length} edges must be measured, because each appears exactly once in the composition and an omitted one silently removes the whole failure class below it.`,
      );
    for (const [label, value] of [
      ["eligible", edge.eligible],
      ["reached", edge.reached],
    ] as const)
      if (Number.isSafeInteger(value) === false || value < 0)
        throw new Error(
          `Coverage edge \`${name}\` has a ${label} population of ${value}, which is not a non-negative integer.`,
        );
    if (edge.reached > edge.eligible)
      throw new Error(
        `Coverage edge \`${name}\` reaches ${edge.reached} of ${edge.eligible} eligible sources. More sources cannot reach a target than are eligible for it, so the two counts were taken over different populations.`,
      );
    return {
      name,
      eligible: edge.eligible,
      reached: edge.reached,
      rate: edge.eligible === 0 ? null : edge.reached / edge.eligible,
    };
  };
}
