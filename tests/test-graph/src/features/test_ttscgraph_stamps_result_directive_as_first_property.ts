import { TestProject } from "@ttsc/testing";

import { TtsgraphClient, assert } from "../internal/ttsgraph";

interface ToolResult {
  content: { type: string; text: string }[];
}

const GRAPH_TOOL_NAME = "inspect_typescript_graph";

const escapeArguments = () => ({
  question: "The next evidence is outside the indexed TypeScript graph.",
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

const overviewArguments = () => ({
  question: "Summarize project shape from graph index facts.",
  draft: {
    reason: "An overview is the smallest useful architecture request.",
    type: "overview",
  },
  review: "Confirmed: read architecture facts from the graph, not from files.",
  request: {
    type: "overview",
    aspect: "all",
  },
});

/**
 * Verifies every graph result is stamped with the sacred `directive` as its
 * first serialized property, on both the escape branch and a real graph
 * branch.
 *
 * Locks the source-order convergence fix from issue #388: the handler must fill
 * `IResult.directive` before `result` so the trust reminder is the first text
 * the model reads in the payload, and it must stamp uniformly across request
 * types (escape included) rather than only the graph branches. A regression
 * that drops the stamp on any branch, or lets `result` serialize first, would
 * silently restore the re-verification behavior the directive exists to stop. A
 * successful structured return also proves typia's reflected `IResult` schema
 * accepts the added field.
 *
 * 1. Materialize a real project and start one MCP server.
 * 2. Call the escape branch and a non-escape (`overview`) branch.
 * 3. Assert each raw payload lists `directive` first as a non-empty string,
 *    identical across branches, while `result.type` still mirrors the request.
 */
export const test_ttscgraph_stamps_result_directive_as_first_property =
  async () => {
    const root = TestProject.createProject({
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "commonjs",
          strict: true,
          rootDir: "src",
          outDir: "dist",
        },
        include: ["src"],
      }),
      "src/index.ts": "export class Widget {}\n",
    });

    const client = TtsgraphClient.start(root);
    const directives: string[] = [];
    try {
      await client.request("initialize", {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "test-graph", version: "0.0.0" },
      });
      client.notify("notifications/initialized", {});

      const call = async (
        args: Record<string, unknown>,
        expectedType: string,
      ): Promise<void> => {
        const result = (await client.request("tools/call", {
          name: GRAPH_TOOL_NAME,
          arguments: args,
        })) as ToolResult;
        const raw = result.content[0]?.text ?? "{}";
        const parsed = JSON.parse(raw) as {
          directive?: unknown;
          result?: { type?: string };
        };
        assert.equal(
          Object.keys(parsed)[0],
          "directive",
          `directive must serialize first in the payload: ${raw}`,
        );
        assert.ok(
          typeof parsed.directive === "string" && parsed.directive.length > 0,
          `directive must be a non-empty string: ${raw}`,
        );
        assert.equal(
          parsed.result?.type,
          expectedType,
          `result.type must still mirror the request: ${raw}`,
        );
        directives.push(parsed.directive as string);
      };

      await call(escapeArguments(), "escape");
      await call(overviewArguments(), "overview");

      assert.equal(
        directives[0],
        directives[1],
        `every branch must stamp the same directive constant: ${JSON.stringify(directives)}`,
      );
    } finally {
      client.endStdin();
    }

    const code = await client.waitForExit();
    assert.equal(
      code,
      0,
      `the launcher should exit cleanly\nstderr: ${client.stderrText()}`,
    );
  };
