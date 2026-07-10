import { TestProject } from "@ttsc/testing";
import fs from "node:fs";
import path from "node:path";

import { TtsgraphClient, assert } from "../internal/ttsgraph";

interface ToolResult {
  content: { type: string; text: string }[];
}

const GRAPH_TOOL_NAME = "inspect_typescript_graph";

const lookupArguments = (query: string) => ({
  question: `Look up ${query} in the current TypeScript source snapshot.`,
  draft: {
    reason: "A named symbol lookup is the smallest useful graph request.",
    type: "lookup",
  },
  review: "Confirmed: use one lookup against the current source snapshot.",
  request: {
    type: "lookup",
    query,
  },
});

const lookupNames = (result: ToolResult): string[] => {
  const value = JSON.parse(result.content[0]?.text ?? "{}") as {
    result?: { type?: string; hits?: { name?: string }[] };
  };
  assert.equal(value.result?.type, "lookup", JSON.stringify(value));
  return (value.result?.hits ?? []).flatMap((hit) =>
    typeof hit.name === "string" ? [hit.name] : [],
  );
};

/**
 * Verifies the MCP graph refreshes a changed source file in the same session.
 *
 * Locks the stale resident-index failure in `startServer`: caching the first
 * dump forever makes every later tool call return declarations from before an
 * agent edit. The second lookup must observe the current disk snapshot without
 * restarting the MCP process.
 *
 * 1. Start one MCP server and look up an exported `BeforeEdit` class.
 * 2. Replace that declaration on disk with `AfterEdit` in the same source file.
 * 3. Look up both names and assert only the post-edit declaration remains.
 */
export const test_ttscgraph_refreshes_changed_source_in_same_mcp_session =
  async () => {
    const root = TestProject.createProject({
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "commonjs",
          strict: true,
        },
        include: ["src"],
      }),
      "src/index.ts": "export class BeforeEdit {}\n",
    });

    const client = TtsgraphClient.start(root);
    try {
      await client.request("initialize", {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "test-graph", version: "0.0.0" },
      });
      client.notify("notifications/initialized", {});

      const before = lookupNames(
        (await client.request("tools/call", {
          name: GRAPH_TOOL_NAME,
          arguments: lookupArguments("BeforeEdit"),
        })) as ToolResult,
      );
      assert.ok(before.includes("BeforeEdit"), JSON.stringify(before));

      fs.writeFileSync(
        path.join(root, "src", "index.ts"),
        "export class AfterEdit {}\n",
      );

      const after = lookupNames(
        (await client.request("tools/call", {
          name: GRAPH_TOOL_NAME,
          arguments: lookupArguments("AfterEdit"),
        })) as ToolResult,
      );
      assert.ok(after.includes("AfterEdit"), JSON.stringify(after));

      const stale = lookupNames(
        (await client.request("tools/call", {
          name: GRAPH_TOOL_NAME,
          arguments: lookupArguments("BeforeEdit"),
        })) as ToolResult,
      );
      assert.ok(!stale.includes("BeforeEdit"), JSON.stringify(stale));
    } finally {
      client.endStdin();
    }

    const code = await client.waitForExit();
    assert.equal(code, 0, client.stderrText());
  };
