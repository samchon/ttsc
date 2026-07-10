import { TestProject } from "@ttsc/testing";
import fs from "node:fs";
import path from "node:path";

import { TtsgraphClient, assert } from "../internal/ttsgraph";

interface ToolResult {
  isError?: boolean;
  content: { type: string; text: string }[];
}

const GRAPH_TOOL_NAME = "inspect_typescript_graph";

const lookupArguments = (query: string) => ({
  question: `Look up ${query} in the synchronized TypeScript graph.`,
  draft: {
    reason: "A named lookup is the smallest graph request.",
    type: "lookup",
  },
  review: "Confirmed: use the current graph snapshot.",
  request: { type: "lookup", query },
});

/**
 * Verifies MCP graph calls fail closed on an invalid config and recover later.
 *
 * A refresh error must never make the server return its previous valid graph as
 * if it described the current project. The native session remains retryable so
 * an agent can fix the config and use the same MCP process afterward.
 *
 * 1. Build an initial graph, then corrupt tsconfig.json.
 * 2. Assert the next tool result is an error rather than stale graph evidence.
 * 3. Restore the config and assert the same server answers successfully again.
 */
export const test_ttscgraph_fails_closed_for_invalid_config_and_recovers =
  async () => {
    const root = TestProject.createProject({
      "tsconfig.json": JSON.stringify({
        compilerOptions: { target: "ES2022", module: "commonjs", strict: true },
        include: ["src"],
      }),
      "src/index.ts": "export class Recoverable {}\n",
    });
    const client = TtsgraphClient.start(root);
    try {
      await client.request("initialize", {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "test-graph", version: "0.0.0" },
      });
      client.notify("notifications/initialized", {});

      const initial = (await client.request("tools/call", {
        name: GRAPH_TOOL_NAME,
        arguments: lookupArguments("Recoverable"),
      })) as ToolResult;
      assert.equal(initial.isError, undefined, initial.content[0]?.text);

      const config = path.join(root, "tsconfig.json");
      fs.writeFileSync(config, "{ invalid");
      const invalid = (await client.request("tools/call", {
        name: GRAPH_TOOL_NAME,
        arguments: lookupArguments("Recoverable"),
      })) as ToolResult;
      assert.equal(invalid.isError, true, JSON.stringify(invalid));
      assert.match(invalid.content[0]?.text ?? "", /invalid project/i);

      fs.writeFileSync(
        config,
        JSON.stringify({
          compilerOptions: {
            target: "ES2022",
            module: "commonjs",
            strict: true,
          },
          include: ["src"],
        }),
      );
      const recovered = (await client.request("tools/call", {
        name: GRAPH_TOOL_NAME,
        arguments: lookupArguments("Recoverable"),
      })) as ToolResult;
      assert.equal(recovered.isError, undefined, recovered.content[0]?.text);
      assert.match(recovered.content[0]?.text ?? "", /Recoverable/);
    } finally {
      client.endStdin();
    }

    assert.equal(await client.waitForExit(), 0, client.stderrText());
  };
