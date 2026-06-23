import { TestProject } from "@ttsc/testing";

import { TtsgraphClient, assert } from "../internal/ttsgraph";

interface ToolResult {
  content: { type: string; text: string }[];
}

/**
 * Verifies the built ttscgraph binary serves the graph and diagnostics to an
 * MCP client end to end over stdio.
 *
 * The Go unit tests pin the server logic in-process; this case proves the
 * shipped binary actually spawns, builds a resident Program for a real project,
 * answers the initialize/tools-list/tools-call cycle over newline-delimited
 * JSON-RPC, and exits cleanly when stdin closes, which is the whole installable
 * pipeline an agent depends on.
 *
 * 1. Materialize a project with a heritage edge (Sub extends Base) and a type
 *    error, then spawn ttscgraph against it.
 * 2. Drive initialize, tools/list, and tools/call for graph_explore and
 *    graph_diagnostics.
 * 3. Assert the explore relationship map, the TS2322 diagnostic, and a clean exit
 *    on stdin close.
 */
export const test_ttscgraph_serves_explore_and_diagnostics_over_mcp =
  async () => {
    const root = TestProject.createProject({
      "tsconfig.json": JSON.stringify(
        {
          compilerOptions: {
            target: "ES2022",
            module: "commonjs",
            strict: true,
            rootDir: "src",
            outDir: "dist",
          },
          files: ["src/main.ts"],
        },
        null,
        2,
      ),
      "src/base.ts": "export class Base {}\n",
      "src/main.ts": [
        'import { Base } from "./base";',
        "export class Sub extends Base {}",
        'export const bad: number = "not a number";',
        "",
      ].join("\n"),
    });

    const client = TtsgraphClient.start(root);
    try {
      const init = (await client.request("initialize", {
        protocolVersion: "2025-06-18",
        capabilities: {},
      })) as { serverInfo?: { name?: string }; instructions?: string };
      assert.equal(
        init.serverInfo?.name,
        "ttsc-graph",
        "initialize returns the server name",
      );
      assert.ok(
        typeof init.instructions === "string" && init.instructions.length > 0,
        "initialize ships usage guidance",
      );
      client.notify("notifications/initialized", {});

      const list = (await client.request("tools/list", {})) as {
        tools: { name: string }[];
      };
      const names = list.tools.map((tool) => tool.name);
      assert.ok(
        names.includes("graph_explore") && names.includes("graph_diagnostics"),
        `tools/list advertises both tools, got ${names.join(", ")}`,
      );

      const explore = (await client.request("tools/call", {
        name: "graph_explore",
        arguments: { query: "Sub" },
      })) as ToolResult;
      const exploreText = explore.content[0]?.text ?? "";
      assert.ok(
        exploreText.includes("Sub") &&
          exploreText.includes("Base") &&
          exploreText.includes("heritage"),
        `graph_explore renders the Sub -> Base heritage relation:\n${exploreText}`,
      );

      const diagnostics = (await client.request("tools/call", {
        name: "graph_diagnostics",
        arguments: { file: "src/main.ts" },
      })) as ToolResult;
      const diagnosticsText = diagnostics.content[0]?.text ?? "";
      assert.ok(
        diagnosticsText.includes("TS2322"),
        `graph_diagnostics surfaces the TS2322 type error:\n${diagnosticsText}`,
      );
    } finally {
      client.endStdin();
    }

    const code = await client.waitForExit();
    assert.equal(
      code,
      0,
      `ttscgraph should exit cleanly on stdin close\nstderr: ${client.stderrText()}`,
    );
  };
