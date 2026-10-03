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

/** Eleven callers, so a twelfth call site puts the target at the threshold. */
const callersOf = (name: string, target: string): string[] =>
  Array.from({ length: 11 }, (_unused, index) =>
    [
      `export function ${name}${index}(): void {`,
      `  ${target}();`,
      "}",
      "",
    ].join("\n"),
  );

/** Ask the resident server for a tour of `source`, seeded on `names`. */
const tourOfProject = async (
  source: string,
  names: string[],
): Promise<TourResult> => {
  let result!: TourResult;
  await withIdentityBoundary(async (client, root) => {
    client.assertInputMutationAllowed();
    fs.writeFileSync(path.join(root, "src", "terminal-tour.ts"), source, "utf8");
    result = tourOf(
      (await client.request("tools/call", {
        name: "inspect_typescript_graph",
        arguments: graphArguments({
          thinking: `I'm new here; show me what ${names.join(" and ")} do.`,
          request: { type: "tour", reinterpretations: names },
        }),
      })) as ToolResult,
    );
  }, ["src/terminal-tour.ts"]);
  return result;
};

/** Every symbol every flow says it reached, plus every flow's start. */
const reachedNames = (tour: TourResult): string[] =>
  tour.primaryFlow.flatMap((flow) => [
    flow.start.name,
    ...flow.reached.map((node) => node.name),
  ]);

/**
 * Verifies the hub cut cannot empty a flow or leave a step dangling.
 *
 * The cut removes a declaration reached from a dozen-plus sites that drives no
 * execution onward. A shared type or leaf helper has that shape, and so does
 * every terminal action — a commit, a send, an audit write — which is the point
 * where the flow performs its work. Degree cannot tell the two apart, so the
 * cut decides only what is noise and the two shapes where deleting a node would
 * destroy the flow are handled without deciding:
 *
 * - A hop into a node the flow continues past is never removed, so no step
 *   narrates a chain from a node the same flow says it never reached;
 * - A flow the cut would empty is demoted rather than deleted — held back, and
 *   told only when the tour finishes with nothing else to say.
 *
 * Each shape needs its own complete compiler universe, which is the point of demotion: a sole-hop
 * terminal action is told **because** its tour has no other flow, and it must
 * not displace one. The negative twin is in
 * `case_ttscgraph_serves_graph_tools_over_mcp`, where a `log` helper with these
 * same degrees sits in a tour that has real chains to tell, and stays absent.
 *
 * 1. Tour a project whose only flow is one hop into a terminal action at twelve
 *    in-edges, and assert the action survives.
 * 2. Tour a project where a hub of the same degree sits mid-chain, and assert the
 *    hop INTO it is the surviving step.
 * 3. Assert in both that every step starts at a symbol its flow reached.
 *
 * @evidence contracts/testing.md#behavioral-verification MCP tour retains the sole auditWrite terminal action and keeps the step entering commitTx even when its twelve callers make it a hub before flush.
 * @evidence contracts/testing.md#independent-expectations Authored twelve-way fan-in and named call chains define the terminal and intermediate actions; step strings must refer from a name retained by start/reached.
 * @evidence contracts/testing.md#distinguishing-cases A terminal hub-only flow contrasts a mid-chain hub with downstream work. The step-handle check covers its source endpoint, not both endpoints.
 * @evidence contracts/testing.md#execution-ownership Called by test_e2e_graph, the exported scene case_ttscgraph_tour_keeps_the_terminal_action_it_ends_at borrows the shared workspace-built MCP launcher and explicitly selected real native session, not a consumer-local packed SDK installation and drives its actual stdio connection; it remains in the E2E runner/Evidence population, with the per-case assertions above rather than source-unit execution.
 * @evidence contracts/e2e.md#necessary-boundary Native fan-in/call edges and tour's hub demotion must interact over actual snapshot transport; a graph-free string/layout assertion cannot establish these flows.
 * @evidence contracts/e2e.md#shared-execution Terminal-only and mid-chain twelve-way fan-in variants reuse the same identity project/client, each scoped to terminal-tour.ts and settled before the next. Actual MCP flows supply retained-action/step checks; neighboring cached CLI facts do not. Sharing the client is not Program-reuse/count or packed-installation proof.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Before either variant, original source bytes or actual ENOENT absence are captured. Actual client authority guards each variant write and final byte/absence restoration; operation and reset failures are collected and failed reset withdraws reuse. Scoped config restoration remains the existing owner. Unconfirmed transport forbids reset and retains inputs until owned joins establish cleanup authority.
 * @evidence contracts/e2e.md#preserved-coverage Original terminal flow, retained entering step and source-name handle checks remain. The negative logger-hub control is separately exercised by serves_graph_tools_over_mcp.
 */
export const case_ttscgraph_tour_keeps_the_terminal_action_it_ends_at =
  async () => {
    await withIdentityBoundary(async (owner, root) => {
      const sourceFile = path.join(root, "src", "terminal-tour.ts");
      let originalSource: Buffer | undefined;
      try {
        originalSource = fs.readFileSync(sourceFile);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
      const failures: unknown[] = [];
      try {
        // Eleven callers plus `Service.handle` put `auditWrite` at exactly twelve,
        // and nothing in this project drives a longer chain, so the whole tour is
        // hop-into-a-hub. Eleven callers kept the flow and a twelfth erased it.
        const terminal = await tourOfProject(
          [
            "export function auditWrite(): void {}",
            "",
            ...callersOf("auditCaller", "auditWrite"),
            "export class Service {",
            "  public handle(): void {",
            "    auditWrite();",
            "  }",
            "}",
            "",
          ].join("\n"),
          ["Service.handle"],
        );
        assert.ok(
          reachedNames(terminal).includes("auditWrite"),
          `a flow whose only hop lands on a terminal action must survive: ${JSON.stringify(terminal.primaryFlow)}`,
        );

        // `commitTx` carries the same fan-in with one outgoing execution edge, so
        // it is still a hub by degree and the flow continues past it.
        const midChain = await tourOfProject(
          [
            "export function flushBuffer(): void {}",
            "export function commitTx(): void {",
            "  flushBuffer();",
            "}",
            "",
            ...callersOf("commitCaller", "commitTx"),
            "export class Service {",
            "  public report(): void {",
            "    commitTx();",
            "  }",
            "}",
            "",
          ].join("\n"),
          ["Service.report"],
        );
        // Asserted on the step, not on `reached`: `reached` is derived from BOTH
        // endpoints of every kept hop, so `commitTx` appears there even when only
        // the hop OUT of it survived — which is the incoherent shape this rule
        // exists to prevent, and an assertion that cannot see it proves nothing.
        const steps = midChain.primaryFlow.flatMap((flow) => flow.steps);
        assert.ok(
          steps.some((step) => step.includes("-> commitTx")),
          `a hub the flow continues past must keep its inbound hop: ${steps.join(" | ")}`,
        );

        // This control checks each step's source-name suffix against the flow's
        // retained start/reached names. It does not validate the target endpoint.
        for (const tour of [terminal, midChain])
          for (const flow of tour.primaryFlow) {
            const reached = new Set([
              flow.start.name,
              ...flow.reached.map((node) => node.name),
            ]);
            for (const step of flow.steps) {
              const [lhs] = step.split(" -[");
              const short = (lhs ?? "").split(".").pop() ?? "";
              assert.ok(
                [...reached].some((name) => name.endsWith(short)),
                `step starts at a symbol the flow never reached: ${step}`,
              );
            }
          }
      } catch (error) {
        failures.push(error);
      } finally {
        try {
          owner.assertInputMutationAllowed();
          if (originalSource === undefined) fs.rmSync(sourceFile, { force: true });
          else fs.writeFileSync(sourceFile, originalSource);
        } catch (error) {
          owner.preventInputReuse("Terminal tour source restoration failed");
          failures.push(error);
        }
      }
      if (failures.length === 1) throw failures[0];
      if (failures.length > 1)
        throw new AggregateError(failures, "Terminal tour variants and reset failed");
    });
  };