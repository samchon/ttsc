import { TestProject } from "@ttsc/testing";

import { TtsgraphClient, assert } from "../internal/ttsgraph";

interface ToolResult {
  content: { type: string; text: string }[];
}

const graphArguments = () => ({
  question:
    "This is not a TypeScript source graph question, so the tool should exit.",
  graphNeed: "The review decides graph evidence is unnecessary.",
  draft: {
    reason: "Avoid loading the graph for a non-graph task.",
    type: "escape",
  },
  review:
    "The draft is correct: skip the resident graph because no TypeScript evidence is needed.",
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
 * the escape branch returns before calling the dump binary or any graph
 * traversal.
 *
 * 1. Materialize a project with an intentionally invalid tsconfig.
 * 2. Initialize the MCP server and call only escape.
 * 3. Assert the tool succeeds and the process exits cleanly.
 */
export const test_ttscgraph_skip_request_does_not_load_graph = async () => {
  const root = TestProject.createProject({
    "tsconfig.json": "{ this is not valid json",
  });

  const client = TtsgraphClient.start(root);
  try {
    await client.request("initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "test-graph", version: "0.0.0" },
    });
    client.notify("notifications/initialized", {});

    const result = (await client.request("tools/call", {
      name: "inspect_typescript_project_graph_before_answering",
      arguments: graphArguments(),
    })) as ToolResult;
    const parsed = JSON.parse(result.content[0]?.text ?? "{}") as {
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
