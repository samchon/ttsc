import fs from "node:fs";
import path from "node:path";
import { withIdentityBoundary } from "../../../internal/graph/internal/identityBoundary";

import { assert } from "../../../internal/graph/internal/ttsgraph";

interface ToolResult {
  content: { type: string; text: string }[];
  structuredContent?: unknown;
}

interface TourResult {
  type: "tour";
  primaryFlow: {
    start: { id: string; name: string };
    steps: string[];
    reached: { id: string; name: string }[];
  }[];
}

const graphArguments = (props: {
  thinking: string;
  request: Record<string, unknown>;
}) => ({
  question: props.thinking,
  draft: {
    reason: "The smallest useful sacred graph step.",
    type: props.request.type,
  },
  review:
    "Confirmed: keep this final request; do not replace graph facts with file reads.",
  request: props.request,
});

const tourOf = (result: ToolResult): TourResult => {
  const value = (result.structuredContent ?? {}) as { result?: TourResult };
  if (value.result?.type !== "tour")
    throw new Error(`Unexpected graph result: ${JSON.stringify(value)}`);
  return value.result;
};

/** Ask the resident server for a tour of `source`, seeded on `names`. */
const tourOfProject = async (
  source: string,
  names: string[],
): Promise<TourResult> => {
  let result!: TourResult;
  await withIdentityBoundary(async (client, root) => {
    client.assertInputMutationAllowed();
    fs.writeFileSync(path.join(root, "src", "recursive-tour.ts"), source, "utf8");
    result = tourOf(
      (await client.request("tools/call", {
        name: "inspect_typescript_graph",
        arguments: graphArguments({
          thinking: `I'm new here; show me what ${names.join(" and ")} do.`,
          request: { type: "tour", reinterpretations: names },
        }),
      })) as ToolResult,
    );
  }, ["src/recursive-tour.ts"]);
  return result;
};

const SELF_RECURSIVE = [
  "export function attempt(): void {",
  "  attempt();",
  "}",
  "",
].join("\n");

const REAL_FLOW = [
  "export function work(): void {}",
  "export function handle(): void {",
  "  work();",
  "}",
  "",
].join("\n");

/**
 * Verifies one self-recursive function cannot silence the flows ranked after
 * it.
 *
 * `runTour` deduplicates flows by comparing where each candidate landed against
 * what it has already told, and `overlaps` reported a match whenever the
 * smaller of the two sets was empty. `told` is a candidate for "smaller", so
 * one empty set entering it made every later candidate a synonym of nothing.
 *
 * A directly self-recursive function produces exactly that set: `runTrace`
 * records a back-edge to the start as a hop without adding a node, because the
 * start travels separately, so the flow had a hop and reached nobody. The tour
 * then published one flow that said it went nowhere and discarded every real
 * flow behind it. Recursion is ordinary — a retry loop, a tree walk, a parser's
 * descent — so this was not an exotic input.
 *
 * The recursive function is named `attempt` on purpose. Dump nodes are sorted
 * by id, so a name that sorts AFTER `handle` puts the empty candidate last,
 * where it poisons nothing and the test passes against the unfixed code.
 * `attempt` sorts first, which is the ordering the defect needs.
 *
 * 1. Tour a project holding a self-recursive function and a real two-hop chain.
 * 2. Assert the real chain is reported.
 * 3. Assert no flow was published with an empty `reached`.
 * 4. Tour the same project without the self-recursive function and assert it
 *    reports the same set of non-empty flows, so the recursion changes nothing
 *    about what the tour says.
 *
 * @evidence contracts/testing.md#behavioral-verification MCP tour keeps the real handle-to-work flow despite an earlier-ranked self-recursive seed and produces the same flow shape as the counterpart source variant without that recursion in the same project.
 * @evidence contracts/testing.md#independent-expectations Authored self recursion reaches no new handle, whereas handle calls work; literal flow-shape comparison is a metamorphic control independent of seed implementation.
 * @evidence contracts/testing.md#distinguishing-cases A self-only first candidate contrasts a moving flow and a no-recursion source variant in the same project; every returned flow must reach something and work must survive.
 * @evidence contracts/testing.md#execution-ownership Called by test_e2e_graph, the exported scene case_ttscgraph_tour_keeps_flows_after_a_self_recursive_seed borrows the shared workspace-built MCP launcher and explicitly selected real native session, not a consumer-local packed SDK installation and drives its actual stdio connection; it remains in the E2E runner/Evidence population, with the per-case assertions above rather than source-unit execution.
 * @evidence contracts/e2e.md#necessary-boundary Native recursive call edges and ranking facts must reach tour composition so a self-edge cannot consume its flow search budget at the real boundary.
 * @evidence contracts/e2e.md#shared-execution The recursive and no-recursion source variants reuse the same identity project/client, each scoped to recursive-tour.ts and settled before the next. Their actual MCP flow responses supply the comparison, not neighboring cached CLI facts. Client/input sharing does not prove Program reuse, construction counts or packed installation.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Before either variant, the original source bytes or actual ENOENT absence are captured. Actual client authority guards each variant write and final byte/absence restoration; operation and reset failures are collected, and failed reset withdraws reuse. Scoped config restoration remains the existing owner. Unconfirmed transport forbids reset and retains inputs until owned joins establish cleanup authority.
 * @evidence contracts/e2e.md#preserved-coverage Work reachability, nonempty reached sets and exact normalized flow-shape comparison remain; no recursion fixture or comparative assertion is removed.
 */
export const case_ttscgraph_tour_keeps_flows_after_a_self_recursive_seed =
  async () => {
    await withIdentityBoundary(async (owner, root) => {
      const sourceFile = path.join(root, "src", "recursive-tour.ts");
      let originalSource: Buffer | undefined;
      try {
        originalSource = fs.readFileSync(sourceFile);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
      const failures: unknown[] = [];
      try {
        const withRecursion = await tourOfProject(`${SELF_RECURSIVE}${REAL_FLOW}`, [
          "attempt",
          "handle",
        ]);

        const reaches = (tour: TourResult, name: string): boolean =>
          tour.primaryFlow.some((flow) =>
            flow.reached.some((node) => node.name === name),
          );

        assert.ok(
          reaches(withRecursion, "work"),
          `the real chain must survive a self-recursive seed: ${JSON.stringify(withRecursion.primaryFlow)}`,
        );
        for (const flow of withRecursion.primaryFlow)
          assert.ok(
            flow.reached.length > 0,
            `a flow that reached nothing was published: ${JSON.stringify(flow)}`,
          );

        // The negative twin, and the reason the assertions above prove anything:
        // the same project without the recursion must report the same flows, so the
        // recursion's presence is what is measured rather than the fixture
        // happening to rank the chain first.
        const withoutRecursion = await tourOfProject(REAL_FLOW, ["handle"]);
        const shape = (tour: TourResult): string =>
          JSON.stringify(
            tour.primaryFlow.map((flow) => [
              flow.start.name,
              flow.reached.map((node) => node.name).sort(),
            ]),
          );
        assert.equal(
          shape(withRecursion),
          shape(withoutRecursion),
          "the self-edge must not change which flows the tour reports",
        );
      } catch (error) {
        failures.push(error);
      } finally {
        try {
          owner.assertInputMutationAllowed();
          if (originalSource === undefined) fs.rmSync(sourceFile, { force: true });
          else fs.writeFileSync(sourceFile, originalSource);
        } catch (error) {
          owner.preventInputReuse("Recursive tour source restoration failed");
          failures.push(error);
        }
      }
      if (failures.length === 1) throw failures[0];
      if (failures.length > 1)
        throw new AggregateError(failures, "Recursive tour variants and reset failed");
    });
  };