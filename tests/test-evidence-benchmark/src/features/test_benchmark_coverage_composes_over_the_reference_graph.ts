import { EvidenceBenchmarkCoverage } from "../../../../benchmarks/evidence/src/EvidenceBenchmarkCoverage";
import type {
  ITtscEvidenceBenchmarkCoverage,
  ITtscEvidenceBenchmarkCoverageMeasurement,
} from "../../../../benchmarks/evidence/src/structures/ITtscEvidenceBenchmarkCoverage";

/**
 * Locks the operators the coverage composition folds the reference graph with.
 *
 * This module contains nothing but arithmetic, and the arithmetic is the only
 * thing that can be wrong in it. Both operators are individually plausible and
 * both produce a number, so a composition that applies the wrong one anywhere
 * still publishes a figure and nothing downstream notices. The case therefore
 * hand-computes the fold over one fixture and compares the whole result, rather
 * than asserting the score is merely within some range.
 *
 * The fixture is chosen so that the two known-wrong compositions land far from
 * the right one: averaging all thirteen rates gives 52.3% and multiplying them
 * gives 0.007%, against the correct 28.2%. Any of the three would look like a
 * coverage figure in a report.
 */
export const test_benchmark_coverage_composes_over_the_reference_graph =
  (): void => {
    const measurement: ITtscEvidenceBenchmarkCoverageMeasurement = {
      columnToProperty: { eligible: 10, reached: 8 }, // 0.8
      screenToJourney: { eligible: 2, reached: 1 }, // 0.5
      hookToScreen: { eligible: 5, reached: 4 }, // 0.8
      accessorToTest: { eligible: 4, reached: 1 }, // 0.25
      accessorToHook: { eligible: 2, reached: 1 }, // 0.5
      modelToOperation: { eligible: 2, reached: 1 }, // 0.5
      modelToDto: { eligible: 4, reached: 3 }, // 0.75
      requirementToModel: { eligible: 2, reached: 1 }, // 0.5
      requirementToOperation: { eligible: 2, reached: 1 }, // 0.5
      requirementToDto: { eligible: 4, reached: 1 }, // 0.25
      requirementToTest: { eligible: 4, reached: 3 }, // 0.75
      requirementToScreen: { eligible: 2, reached: 1 }, // 0.5
      requirementToJourney: { eligible: 5, reached: 1 }, // 0.2
    };
    const coverage: ITtscEvidenceBenchmarkCoverage =
      EvidenceBenchmarkCoverage.plain(measurement);

    // Folded from the leaves up: multiply along a chain, average across
    // branches. Q(dto) = 0.8 and Q(screen) = 0.5 are their single edges;
    // Q(hook) = 0.8 × 0.5 = 0.4; Q(api) = mean(0.25 × 1, 0.5 × 0.4) = 0.225;
    // Q(model) = mean(0.5 × 0.225, 0.75 × 0.8) = 0.35625.
    close(coverage.wholeness.dto, 0.8, "Q(dto)");
    close(coverage.wholeness.screen, 0.5, "Q(screen)");
    close(coverage.wholeness.hook, 0.4, "Q(hook)");
    close(coverage.wholeness.api, 0.225, "Q(api)");
    close(coverage.wholeness.model, 0.35625, "Q(model)");

    // S = mean(0.5 × 0.35625, 0.5 × 0.225, 0.25 × 0.8, 0.75, 0.5 × 0.5, 0.2).
    close(coverage.score, 1.690625 / 6, "S");

    // The two compositions the method rejects, computed over the same rates.
    if (near(coverage.score, 6.8 / 13))
      throw new Error(
        "The coverage score equals the unweighted mean of all thirteen edge rates, so the composition ignores the graph's structure entirely and lets a healthy near end average away a broken far end.",
      );
    if (near(coverage.score, 0.0000703125))
      throw new Error(
        "The coverage score equals the product of all thirteen edge rates, so the composition treats branches as a chain. Multiplication answers what share satisfies every branch at once, which equals the product only when branches fail independently, and they do not.",
      );

    // Every measured edge appears exactly once. One counted twice penalises its
    // subgraph twice; one omitted hides the whole failure class below it.
    if (coverage.edges.length !== 13)
      throw new Error(
        `The composition reported ${coverage.edges.length} edges, but the reference graph has thirteen.`,
      );
    if (new Set(coverage.edges.map((edge) => edge.name)).size !== 13)
      throw new Error(
        "The composition reported a duplicated edge, which double-penalises the subgraph below it.",
      );

    empty();
    invalid();
    evidence();
  };

/**
 * An empty population is an absent question, never a satisfied one.
 *
 * This is the failure the measurement integrity rules name directly: a claim
 * that reaches an empty population reports full coverage while checking
 * nothing. Scoring such an edge as one would make a codebase with no journeys
 * at all outscore one that has some and misses others.
 */
const empty = (): void => {
  const measurement: ITtscEvidenceBenchmarkCoverageMeasurement = {
    columnToProperty: { eligible: 10, reached: 8 },
    screenToJourney: { eligible: 0, reached: 0 },
    hookToScreen: { eligible: 5, reached: 4 },
    accessorToTest: { eligible: 4, reached: 1 },
    accessorToHook: { eligible: 2, reached: 1 },
    modelToOperation: { eligible: 2, reached: 1 },
    modelToDto: { eligible: 4, reached: 3 },
    requirementToModel: { eligible: 2, reached: 1 },
    requirementToOperation: { eligible: 2, reached: 1 },
    requirementToDto: { eligible: 4, reached: 1 },
    requirementToTest: { eligible: 4, reached: 3 },
    requirementToScreen: { eligible: 2, reached: 1 },
    requirementToJourney: { eligible: 5, reached: 1 },
  };
  const coverage: ITtscEvidenceBenchmarkCoverage =
    EvidenceBenchmarkCoverage.plain(measurement);

  if (coverage.wholeness.screen !== null || coverage.wholeness.hook !== null)
    throw new Error(
      "An edge with no eligible sources reported a rate. It has to report nothing, and the unmeasurable result has to propagate up the chain that depends on it.",
    );
  const screen = coverage.obligations.find(
    (obligation) => obligation.name === "screen",
  );
  if (screen === undefined || screen.value !== null)
    throw new Error(
      "The screen obligation was scored even though what it reaches was never measured.",
    );

  // Q(hook) is unmeasurable, so Q(api) = 0.25 alone, Q(model) = mean(0.125,
  // 0.6) = 0.3625, and the score averages the five obligations that remain.
  close(coverage.score, 1.45625 / 5, "S with one unmeasurable branch");

  const nothing: ITtscEvidenceBenchmarkCoverageMeasurement = Object.fromEntries(
    EvidenceBenchmarkCoverage.EDGE_NAMES.map((name) => [
      name,
      { eligible: 0, reached: 0 },
    ]),
  ) as unknown as ITtscEvidenceBenchmarkCoverageMeasurement;
  if (EvidenceBenchmarkCoverage.plain(nothing).score !== null)
    throw new Error(
      "A codebase whose every population is empty produced a score. It was never asked the question, so the honest output is nothing at all — and certainly not the full marks an empty population would otherwise earn.",
    );
};

/** Counts taken over two different populations are a measurement error. */
const invalid = (): void => {
  const measurement: ITtscEvidenceBenchmarkCoverageMeasurement =
    Object.fromEntries(
      EvidenceBenchmarkCoverage.EDGE_NAMES.map((name) => [
        name,
        { eligible: 2, reached: 1 },
      ]),
    ) as unknown as ITtscEvidenceBenchmarkCoverageMeasurement;
  for (const edge of [
    { eligible: 2, reached: 3 },
    { eligible: -1, reached: 0 },
    { eligible: 1.5, reached: 1 },
  ]) {
    let thrown: boolean = false;
    try {
      EvidenceBenchmarkCoverage.plain({
        ...measurement,
        requirementToTest: edge,
      });
    } catch {
      thrown = true;
    }
    if (thrown === false)
      throw new Error(
        `The composition accepted the population ${JSON.stringify(edge)}, which no count of a real codebase can produce.`,
      );
  }
};

/** The Evidence arm is complete by construction and is never measured. */
const evidence = (): void => {
  const coverage: ITtscEvidenceBenchmarkCoverage =
    EvidenceBenchmarkCoverage.evidence();
  if (coverage.score !== 1)
    throw new Error(
      "The Evidence arm scored below one. Its plugin enforces every edge as a build gate, so a cell that compiled has already satisfied the graph.",
    );
  if (coverage.measured !== false)
    throw new Error(
      "The Evidence arm reported itself as measured. Nothing was analyzed and nothing was counted, and a reader has to be able to see that from the record rather than assume a workspace was inspected.",
    );
};

const near = (left: number | null, right: number): boolean =>
  left !== null && Math.abs(left - right) < 1e-12;

const close = (actual: number | null, expected: number, what: string): void => {
  if (near(actual, expected) === false)
    throw new Error(
      `${what} composed to ${actual === null ? "nothing" : actual}, but folding the graph gives ${expected}.`,
    );
};
