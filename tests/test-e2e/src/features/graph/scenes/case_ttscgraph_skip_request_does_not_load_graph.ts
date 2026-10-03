import fs from "node:fs";
import path from "node:path";

import { FixtureFiles } from "../../../internal/FixtureFiles";
import { withIdentityBoundary } from "../../../internal/graph/internal/identityBoundary";
import { assert } from "../../../internal/graph/internal/ttsgraph";

interface ToolResult {
  isError?: boolean;
  content: { type: string; text: string }[];
  structuredContent?: unknown;
}

const GRAPH_TOOL_NAME = "inspect_typescript_graph";

const graphArguments = () => ({
  question:
    "This is not a TypeScript source graph question, so the tool should exit.",
  draft: {
    reason: "The next evidence is outside the indexed TypeScript graph.",
    type: "escape",
  },
  review: "Confirmed: skip graph work and return escape.",
  request: {
    type: "escape",
    reason: "No graph operation is needed for this request.",
    nextStep: "Use non-graph evidence.",
  },
});

/**
 * Verifies escape does not load the resident graph.
 *
 * The graph launcher builds the TypeScript graph lazily on the first real graph
 * operation. A bad tsconfig would fail that load; successful escape retains the
 * invalid-config control, while exact successful-child receipts establish that
 * the installed graph producer was not created.
 *
 * 1. Borrow the shared MCP before any native graph request and corrupt its config.
 * 2. Require escape to succeed with zero observed successful native child
 *    creations.
 * 3. Restore config bytes and require a real Recoverable lookup in the same
 *    session.
 * 4. The package experiment joins this shared process after all its consumers.
 *
 * @evidence contracts/testing.md#behavioral-verification MCP escape succeeds and reports skipped with invalid config and zero exact-producer successful-spawn receipts; restored config yields Recoverable and one native spawn. The experiment retains the clean shared-process exit assertion.
 * @evidence contracts/testing.md#independent-expectations The deliberately invalid JSON would prevent an actual graph load; literal skipped and non-error results independently establish that escape remains usable.
 * @evidence contracts/testing.md#distinguishing-cases A graph-free cold request faces invalid config, then a real graph request uses restored input. The observational preload subscribes to Node process diagnostics and successful spawn events without replacing native calls; its synchronous receipt write can affect timing, so this is not a race-timing oracle.
 * @evidence contracts/testing.md#execution-ownership Called first by test_e2e_graph, the exported scene starts the workspace-built MCP launcher with explicit real native selection, not a packed SDK installation, observes its cold graph-free escape, then requires real Recoverable facts after config restoration in that same MCP. It remains selected by the E2E runner/Evidence population.
 * @evidence contracts/e2e.md#necessary-boundary Actual workspace MCP startup and lazy application dispatch must permit escape without resolving a compiler project; direct escape calls would bypass lazy server assembly.
 * @evidence contracts/e2e.md#shared-execution This runs first and borrows the identity project's existing MCP lifetime; the restored lookup warms the same producer later graph cases consume. No separate invalid project or MCP child is prepared. The diagnostics receipt counts only this selected native executable's successful spawns in that launcher process, not other processes, failed attempts or compiler Program objects.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Actual client mutation authority is checked before writing invalid config as well as before finally restoring original bytes after a settled response; failed restoration blocks reuse. A timed-out or lost transport forbids reset and retains project and receipt inputs until the experiment attempts actual child joins. Zero initial successful-spawn receipts forbids an already-warmed session from satisfying the cold oracle. Diagnostics end with the MCP, and the exclusive receipt has a separate owned directory outside compiler inputs.
 * @evidence contracts/e2e.md#preserved-coverage Original escape type, skipped and clean exit remain; exact native spawn observation and restored real declaration strengthen the original invalid-config control.
 */
export const case_ttscgraph_skip_request_does_not_load_graph = async () => {
  await withIdentityBoundary(async (client, root) => {
    const configFile = path.join(root, "tsconfig.json");
    const original = fs.readFileSync(configFile);
    assert.equal(
      client.nativeSpawnCount(),
      0,
      "escape must run before the shared native producer is loaded",
    );
    const failures: unknown[] = [];
    try {
      client.assertInputMutationAllowed();
      fs.writeFileSync(
        configFile,
        FixtureFiles.read(
          "graph/ttscgraph_skip_request_does_not_load_graph/inputs-1",
        )["tsconfig.json"]!,
      );

      const result = (await client.request("tools/call", {
        name: GRAPH_TOOL_NAME,
        arguments: graphArguments(),
      })) as ToolResult;
      assert.equal(result.isError, undefined, JSON.stringify(result));
      const parsed = (result.structuredContent ?? {}) as {
        result?: { type?: string; skipped?: boolean };
      };
      assert.equal(
        parsed.result?.type,
        "escape",
        `skip branch should return its own result: ${JSON.stringify(parsed)}`,
      );
      assert.equal(
        parsed.result?.skipped,
        true,
        `skip branch should mark the graph operation skipped: ${JSON.stringify(parsed)}`,
      );
      assert.equal(
        client.nativeSpawnCount(),
        0,
        "escape started the exact native graph producer",
      );
    } catch (error) {
      failures.push(error);
    } finally {
      try {
        client.assertInputMutationAllowed();
        fs.writeFileSync(configFile, original);
      } catch (error) {
        client.preventInputReuse("Cold escape config restoration failed");
        failures.push(error);
      }
    }
    if (failures.length === 1) throw failures[0];
    if (failures.length > 1)
      throw new AggregateError(failures, "Cold escape and input reset failed");
    const recovered = (await client.request("tools/call", {
      name: GRAPH_TOOL_NAME,
      arguments: {
        question: "Find Recoverable after restoring the compiler project.",
        draft: {
          reason: "Verify the restored project in the same session.",
          type: "lookup",
        },
        review: "Use the restored compiler snapshot.",
        request: { type: "lookup", query: "Recoverable" },
      },
    })) as ToolResult & { isError?: boolean };
    assert.equal(recovered.isError, undefined, JSON.stringify(recovered));
    assert.match(
      JSON.stringify(recovered.structuredContent ?? {}),
      /Recoverable/,
    );
    assert.equal(
      client.nativeSpawnCount(),
      1,
      "the restored lookup must reach the real resident producer once",
    );
  });
};
