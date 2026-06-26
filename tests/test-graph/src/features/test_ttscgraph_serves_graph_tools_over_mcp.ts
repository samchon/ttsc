import { TestProject } from "@ttsc/testing";

import { TtsgraphClient, assert } from "../internal/ttsgraph";

interface ToolResult {
  content: { type: string; text: string }[];
}

const callJson = <T>(result: ToolResult): T =>
  JSON.parse(result.content[0]?.text ?? "{}") as T;

/**
 * Verifies the @ttsc/graph launcher serves the redesigned graph tools to an MCP
 * client end to end over stdio.
 *
 * The TypeScript engine is unit-smoked in isolation; this case proves the
 * shipped pipeline works: the Node launcher spawns, runs `ttscgraph dump` once
 * for a real project, builds the resident graph, and answers
 * initialize/tools-list/tools-call for graph_overview, graph_query,
 * graph_trace, and graph_expand, then exits cleanly when stdin closes.
 *
 * 1. Materialize a project with a Service.run -> helper call chain, then spawn the
 *    launcher against it.
 * 2. Drive initialize, tools/list, and a call to each of the four tools.
 * 3. Assert the architecture counts, a query hit, the forward trace reaching the
 *    callee, expanded source, and a clean exit.
 */
export const test_ttscgraph_serves_graph_tools_over_mcp = async () => {
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
        include: ["src"],
      },
      null,
      2,
    ),
    "src/app.ts": [
      "export function helper(): void {}",
      "export class Service {",
      "  run(): void {",
      "    helper();",
      "  }",
      "}",
      "",
    ].join("\n"),
  });

  const client = TtsgraphClient.start(root);
  try {
    const init = (await client.request("initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "test-graph", version: "0.0.0" },
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
    const names = list.tools.map((tool) => tool.name).sort();
    assert.deepEqual(
      names,
      ["graph_expand", "graph_overview", "graph_query", "graph_trace"],
      `tools/list advertises the four graph tools, got ${names.join(", ")}`,
    );

    // graph_overview: a compact architecture map with real counts.
    const overview = callJson<{
      counts: { nodes: number; byKind: Record<string, number> };
    }>(
      (await client.request("tools/call", {
        name: "graph_overview",
        arguments: { aspect: "all" },
      })) as ToolResult,
    );
    const byKind = overview.counts.byKind;
    assert.ok(
      overview.counts.nodes > 0 &&
        (byKind.class ?? 0) >= 1 &&
        (byKind.method ?? 0) >= 1 &&
        (byKind.function ?? 0) >= 1 &&
        (byKind.file ?? 0) >= 1,
      `graph_overview returns architecture counts: ${JSON.stringify(overview.counts)}`,
    );

    // graph_query: finds Service by name and returns a handle.
    const query = callJson<{
      hits: { id: string; name: string; kind: string }[];
    }>(
      (await client.request("tools/call", {
        name: "graph_query",
        arguments: { query: "Service" },
      })) as ToolResult,
    );
    const service = query.hits.find((hit) => hit.name === "Service");
    assert.ok(
      service,
      `graph_query finds Service: ${JSON.stringify(query.hits)}`,
    );

    // graph_trace: forward from Service.run reaches the helper it calls.
    const trace = callJson<{ reached: { name: string }[] }>(
      (await client.request("tools/call", {
        name: "graph_trace",
        arguments: { from: "run", direction: "forward" },
      })) as ToolResult,
    );
    assert.ok(
      trace.reached.some((node) => node.name === "helper"),
      `graph_trace forward reaches helper: ${JSON.stringify(trace.reached)}`,
    );

    // graph_expand: reads the declaration source the graph located.
    const runId = service
      ? service.id.replace("Service:class", "Service.run:method")
      : "";
    const expand = callJson<{
      nodes: { id: string; source?: string }[];
      unknown: string[];
    }>(
      (await client.request("tools/call", {
        name: "graph_expand",
        arguments: { handles: [runId], source: true },
      })) as ToolResult,
    );
    assert.ok(
      expand.nodes.some((node) => (node.source ?? "").includes("helper(")),
      `graph_expand returns the run body: ${JSON.stringify(expand.nodes)}`,
    );
  } finally {
    client.endStdin();
  }

  const code = await client.waitForExit();
  assert.equal(
    code,
    0,
    `the launcher should exit cleanly on stdin close\nstderr: ${client.stderrText()}`,
  );
};
