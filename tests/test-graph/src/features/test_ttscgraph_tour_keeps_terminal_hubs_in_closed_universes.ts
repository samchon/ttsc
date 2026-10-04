import assert from "node:assert/strict";

import { runTour } from "../../../../packages/graph/src/server/runTour";
import type { ITtscGraphDump } from "../../../../packages/graph/src/structures/ITtscGraphDump";
import { createSyntheticGraph } from "../internal/resolverGraph";

/**
 * Verifies closed-universe tours retain terminal and intermediate hub actions.
 *
 * A sole hop into a twelve-caller leaf must survive demotion when there is no
 * other moving flow. A hub followed by downstream work must retain its inbound
 * hop. Separate authored graph generations preserve these different decisions;
 * adding unrelated moving flows would change the terminal-only premise.
 *
 * 1. Build a closed auditWrite universe with eleven callers and Service.handle,
 *    then require the sole terminal action and its literal step to survive.
 * 2. Build a separate commitTx universe with eleven callers, Service.report and
 *    flushBuffer, then require both literal steps of that named chain.
 * 3. Check every returned step's source name belongs to its flow's start/reached
 *    handles, retaining the original source-endpoint coherence control.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual runTour over TtscGraphMemory retains auditWrite in the terminal-only twelve-caller universe and the inbound Service.report-to-commitTx step before flushBuffer in the separate intermediate-hub universe. The named flows assert literal steps and reached handles; every returned flow additionally checks its step source against retained start/reached names.
 * @evidence contracts/testing.md#independent-expectations Authored nodes, module exports and call edges specify eleven callers plus the named Service method, exactly twelve incoming calls, and the optional downstream flushBuffer. Literal expected action IDs and call-step strings follow those topologies, not another tour's output. The source-name coherence check intentionally covers source endpoints; it does not claim a general target-endpoint check.
 * @evidence contracts/testing.md#distinguishing-cases The terminal-only graph has no non-hub-moving chain and must tell its demoted sole hop; the intermediate hub has one downstream call and must keep the entering hop. Each universe is constructed independently and both scenarios collect failures. Other native call extraction and the logger hub beside unrelated moving flows are not established here.
 * @evidence contracts/testing.md#execution-ownership This exported unit entry calls createSyntheticGraph, the actual memory/index operations, runTour and runTrace directly from authored source in-process. It starts no compiler Program, native producer, process, MCP host or build. Synthetic edges establish portable tour decisions, not native parser/extraction, transport or producer provenance, which remain separate E2E connections.
 */
export function test_ttscgraph_tour_keeps_terminal_hubs_in_closed_universes(): void {
  const file = "src/terminal-tour.ts";
  const id = (name: string, kind = "function"): string => `${file}#${name}:${kind}`;
  const failures: unknown[] = [];
  for (const scenario of [
    { label: "terminal-only audit", action: "auditWrite", handler: "Service.handle", caller: "auditCaller", downstream: undefined },
    { label: "intermediate commit", action: "commitTx", handler: "Service.report", caller: "commitCaller", downstream: "flushBuffer" },
  ] as const) {
    try {
      const declarations: ITtscGraphDump.INode[] = [
        { id: id(scenario.action), name: scenario.action, kind: "function", file, external: false, exported: true, evidence: { startLine: 1 } },
        ...Array.from({ length: 11 }, (_, index) => ({
          id: id(`${scenario.caller}${index}`), name: `${scenario.caller}${index}`, kind: "function" as const,
          file, external: false, exported: true, evidence: { startLine: index + 2 },
        })),
        { id: id("Service", "class"), name: "Service", kind: "class", file, external: false, exported: true, evidence: { startLine: 13 } },
        { id: id(scenario.handler, "method"), name: scenario.handler.split(".")[1]!, qualifiedName: scenario.handler, kind: "method", file, external: false, evidence: { startLine: 14 } },
      ];
      if (scenario.downstream !== undefined) declarations.push({
        id: id(scenario.downstream), name: scenario.downstream, kind: "function", file, external: false, exported: true, evidence: { startLine: 15 },
      });
      const module = { id: `${file}#module:module`, name: file, kind: "module" as const, file, external: false };
      const edges: ITtscGraphDump.IEdge[] = [
        ...declarations.filter((node) => node.kind !== "method").map((node) => ({ from: module.id, to: node.id, kind: "exports" as const })),
        ...Array.from({ length: 11 }, (_, index) => ({ from: id(`${scenario.caller}${index}`), to: id(scenario.action), kind: "calls" as const })),
        { from: id(scenario.handler, "method"), to: id(scenario.action), kind: "calls" },
      ];
      if (scenario.downstream !== undefined) edges.push({ from: id(scenario.action), to: id(scenario.downstream), kind: "calls" });
      const graph = createSyntheticGraph([module, ...declarations], edges);
      assert.equal(graph.incoming(id(scenario.action)).filter((edge) => edge.kind === "calls").length, 12);
      const tour = runTour(graph, { type: "tour", reinterpretations: [scenario.handler] }, `Show what ${scenario.handler} does.`).result;
      const flow = tour.primaryFlow.find((candidate) => candidate.start.id === id(scenario.handler, "method"));
      assert.ok(flow !== undefined, `${scenario.label}: the named Service flow is retained`);
      if (scenario.downstream === undefined) {
        assert.deepEqual(flow.steps, ["Service.handle -[calls]-> auditWrite"]);
        assert.deepEqual(flow.reached.map((node) => [node.id, node.name]), [["src/terminal-tour.ts#auditWrite:function", "auditWrite"]]);
      } else {
        assert.deepEqual(flow.steps, ["Service.report -[calls]-> commitTx", "commitTx -[calls]-> flushBuffer"]);
        assert.deepEqual(flow.reached.map((node) => [node.id, node.name]), [
          ["src/terminal-tour.ts#commitTx:function", "commitTx"],
          ["src/terminal-tour.ts#flushBuffer:function", "flushBuffer"],
        ]);
      }
      for (const candidate of tour.primaryFlow) {
        const reached = new Set([candidate.start.name, ...candidate.reached.map((node) => node.name)]);
        for (const step of candidate.steps) {
          const [lhs] = step.split(" -[");
          const short = (lhs ?? "").split(".").pop() ?? "";
          assert.ok([...reached].some((name) => name.endsWith(short)), `step starts at an unretained symbol: ${step}`);
        }
      }
    } catch (error) { failures.push(new Error(scenario.label, { cause: error })); }
  }
  if (failures.length !== 0) throw new AggregateError(failures, "closed-universe terminal tour scenarios failed");
}
