import { FixtureFiles } from "../../../internal/FixtureFiles";
import { TestProject } from "@ttsc/testing";

import { TtsgraphClient, assert } from "../../../internal/graph/internal/ttsgraph";

interface ToolResult {
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
 * operation. A bad tsconfig would fail that load, so a successful escape proves
 * the escape branch returns before starting the native session or any graph
 * traversal.
 *
 * 1. Materialize a project with an intentionally invalid tsconfig.
 * 2. Initialize the MCP server and call only escape.
 * 3. Assert the tool succeeds and the process exits cleanly.
 *
 * @evidence contracts/testing.md#behavioral-verification MCP escape succeeds and reports skipped even when the fixture tsconfig is invalid, then the client exits normally.
 * @evidence contracts/testing.md#independent-expectations The deliberately invalid JSON would prevent an actual graph load; literal skipped and non-error results independently establish that escape remains usable.
 * @evidence contracts/testing.md#distinguishing-cases A graph-free request faces a configuration that graph access cannot accept. This is an indirect no-load oracle, not a direct assertion of child spawn counts.
 * @evidence contracts/testing.md#execution-ownership Called by test_e2e_graph, the exported scene case_ttscgraph_skip_request_does_not_load_graph starts the installed MCP launcher and exercises its graph-free escape branch without requiring native graph facts; it remains selected by the E2E runner/Evidence population.
 * @evidence contracts/e2e.md#necessary-boundary Installed MCP startup and lazy application dispatch must permit escape without resolving a compiler project; direct escape calls would bypass lazy server assembly.
 * @evidence contracts/e2e.md#shared-execution One invalid fixture and client reuse the suite launcher artifact; this request does not itself need compiler facts. Sharing with compatible lazy-start checks remains unfinished.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The case owns its invalid config, never warms a graph in that session, ends stdin in finally and checks normal exit.
 * @evidence contracts/e2e.md#preserved-coverage Original non-error, skipped and exit assertions remain. No fake capability or suppressed compiler failure is used to certify the escape branch.
 */
export const case_ttscgraph_skip_request_does_not_load_graph = async () => {
  const root = TestProject.createProject(FixtureFiles.read("graph/ttscgraph_skip_request_does_not_load_graph/inputs-1"));

  const client = TtsgraphClient.start(root);
  try {
    await client.request("initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "test-graph", version: "0.0.0" },
    });
    client.notify("notifications/initialized", {});

    const result = (await client.request("tools/call", {
      name: GRAPH_TOOL_NAME,
      arguments: graphArguments(),
    })) as ToolResult;
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
  } finally {
    client.endStdin();
  }

  const code = await client.waitForExit();
  assert.equal(
    code,
    0,
    `the launcher should exit cleanly without loading the bad tsconfig\nstderr: ${client.stderrText()}`,
  );
};
