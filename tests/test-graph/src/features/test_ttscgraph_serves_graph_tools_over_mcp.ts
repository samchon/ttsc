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
 * initialize/tools-list/tools-call for question_entrypoints, dependency_path,
 * symbol_details, symbol_lookup, and project_overview, then exits cleanly when
 * stdin closes.
 *
 * 1. Materialize a project with a Service.run -> helper call chain, then spawn the
 *    launcher against it.
 * 2. Drive initialize, tools/list, and a call to each of the five tools.
 * 3. Assert the index, architecture counts, a query hit, forward/path traces
 *    reaching the callee, expanded source, and a clean exit.
 */
export const test_ttscgraph_serves_graph_tools_over_mcp = async () => {
  const root = TestProject.createProject({
    "tsconfig.json": JSON.stringify(
      {
        compilerOptions: {
          target: "ES2022",
          module: "commonjs",
          experimentalDecorators: true,
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
      "function Route(path: string): MethodDecorator {",
      "  return () => undefined;",
      "}",
      "export function helper(): void {}",
      "export class Service {",
      "  @Route('/run')",
      "  run(): void {",
      "    helper();",
      "    other();",
      "    third();",
      "    fourth();",
      "    fifth();",
      "  }",
      "}",
      "export function other(): void {}",
      "export function third(): void {}",
      "export function fourth(): void {}",
      "export function fifth(): void {}",
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
    const names = list.tools.map((tool) => tool.name);
    assert.deepEqual(
      names,
      [
        "question_entrypoints",
        "dependency_path",
        "symbol_details",
        "symbol_lookup",
        "project_overview",
      ],
      `tools/list advertises the five graph tools, got ${names.join(", ")}`,
    );

    // question_entrypoints: the first source-free index resolves direct handles and
    // nearby dependency context.
    const index = callJson<{
      hits: {
        id: string;
        name: string;
        signature?: string;
        decorators?: { name: string; arguments: { literal?: unknown }[] }[];
      }[];
      mentions: { handle: string; node?: { name: string } }[];
      neighborhood: {
        name: string;
        dependsOn: {
          name: string;
          evidence?: { startLine?: number; text?: string };
        }[];
      }[];
      next: { traceFrom: string[] };
    }>(
      (await client.request("tools/call", {
        name: "question_entrypoints",
        arguments: { query: "how Service.run reaches helper" },
      })) as ToolResult,
    );
    assert.ok(
      index.hits.some(
        (hit) =>
          hit.name === "Service.run" &&
          (hit.signature ?? "").includes("run(): void"),
      ),
      `question_entrypoints ranks Service.run with a signature: ${JSON.stringify(index.hits)}`,
    );
    assert.ok(
      index.hits.some(
        (hit) =>
          hit.name === "Service.run" &&
          hit.decorators?.some(
            (decorator) =>
              decorator.name === "Route" &&
              decorator.arguments.some((arg) => arg.literal === "/run"),
          ),
      ),
      `question_entrypoints carries decorator facts: ${JSON.stringify(index.hits)}`,
    );
    assert.ok(
      index.mentions.some(
        (mention) =>
          mention.handle === "Service.run" &&
          mention.node?.name === "Service.run",
      ),
      `question_entrypoints resolves direct dotted mentions: ${JSON.stringify(index.mentions)}`,
    );
    assert.ok(
      index.neighborhood.some(
        (node) =>
          node.name === "Service.run" &&
          node.dependsOn.some(
            (ref) =>
              ref.name === "helper" &&
              typeof ref.evidence?.startLine === "number" &&
              (ref.evidence.text ?? "").includes("helper"),
          ),
      ),
      `question_entrypoints includes direct dependency evidence: ${JSON.stringify(index.neighborhood)}`,
    );
    const indexedRun = index.hits.find((hit) => hit.name === "Service.run");
    assert.ok(
      indexedRun !== undefined && index.next.traceFrom.includes(indexedRun.id),
      `question_entrypoints returns trace handles for ranked seeds: ${JSON.stringify(index.next)}`,
    );

    // project_overview: a compact architecture map with real counts.
    const overview = callJson<{
      counts: { nodes: number; byKind: Record<string, number> };
      publicApi?: { id: string; name: string; line?: number }[];
    }>(
      (await client.request("tools/call", {
        name: "project_overview",
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
      `project_overview returns architecture counts: ${JSON.stringify(overview.counts)}`,
    );
    assert.ok(
      overview.publicApi?.some(
        (api) =>
          api.name === "Service" && api.id.length > 0 && api.line !== undefined,
      ),
      `project_overview returns public API handles: ${JSON.stringify(overview.publicApi)}`,
    );

    // symbol_lookup: finds Service by name and ranks explicit method queries.
    const query = callJson<{
      hits: { id: string; name: string; kind: string }[];
      next: { expand: string[]; traceFrom: string[] };
    }>(
      (await client.request("tools/call", {
        name: "symbol_lookup",
        arguments: { query: "Service" },
      })) as ToolResult,
    );
    const service = query.hits.find((hit) => hit.name === "Service");
    assert.ok(
      service,
      `symbol_lookup finds Service: ${JSON.stringify(query.hits)}`,
    );
    assert.ok(
      query.next.expand.includes(service.id) &&
        query.next.traceFrom.includes(service.id),
      `symbol_lookup returns follow-up handles: ${JSON.stringify(query.next)}`,
    );
    const methodQuery = callJson<{
      hits: { name: string; kind: string }[];
    }>(
      (await client.request("tools/call", {
        name: "symbol_lookup",
        arguments: {
          query: "How does the `run` method reach helper?",
          limit: 3,
        },
      })) as ToolResult,
    );
    assert.equal(
      methodQuery.hits[0]?.name,
      "Service.run",
      `symbol_lookup ranks the explicit method target first: ${JSON.stringify(methodQuery.hits)}`,
    );
    assert.equal(
      methodQuery.hits[0]?.kind,
      "method",
      `symbol_lookup preserves the method kind: ${JSON.stringify(methodQuery.hits)}`,
    );

    // dependency_path: forward from Service.run reaches the helper it calls.
    const trace = callJson<{
      reached: { name: string }[];
      hops: { evidence?: { text?: string } }[];
      steps?: string[];
    }>(
      (await client.request("tools/call", {
        name: "dependency_path",
        arguments: { from: "run", direction: "forward", focus: "execution" },
      })) as ToolResult,
    );
    assert.ok(
      trace.reached.some((node) => node.name === "helper"),
      `dependency_path forward reaches helper: ${JSON.stringify(trace.reached)}`,
    );
    assert.ok(
      trace.hops.some((hop) => (hop.evidence?.text ?? "").includes("helper")),
      `dependency_path forward carries hop evidence: ${JSON.stringify(trace.hops)}`,
    );
    assert.ok(
      trace.steps?.some((step) => step.includes("Service.run")),
      `dependency_path returns compact step text: ${JSON.stringify(trace.steps)}`,
    );

    // dependency_path path mode: dotted from handles can be used directly.
    const pathTrace = callJson<{
      path?: { name: string; signature?: string }[];
      steps?: string[];
      next?: { traceFrom: string[] };
    }>(
      (await client.request("tools/call", {
        name: "dependency_path",
        arguments: { from: "Service.run", to: "helper" },
      })) as ToolResult,
    );
    assert.ok(
      pathTrace.path?.some((node) => node.name === "helper"),
      `dependency_path path reaches helper from dotted handle: ${JSON.stringify(pathTrace.path)}`,
    );
    assert.ok(
      pathTrace.path?.some((node) =>
        (node.signature ?? "").includes("run(): void"),
      ),
      `dependency_path path carries signatures: ${JSON.stringify(pathTrace.path)}`,
    );
    assert.ok(
      pathTrace.steps?.some((step) => step.includes("helper")) &&
        (pathTrace.next?.traceFrom.length ?? 0) > 0,
      `dependency_path path returns step text and continuation handles: ${JSON.stringify(pathTrace)}`,
    );

    // symbol_details: reads the declaration source the graph located.
    const expand = callJson<{
      nodes: {
        id: string;
        name: string;
        source?: string;
        sourceSpan?: { file: string; startLine: number; endLine?: number };
        decorators?: { name: string; arguments: { literal?: unknown }[] }[];
      }[];
      unknown: string[];
    }>(
      (await client.request("tools/call", {
        name: "symbol_details",
        arguments: { handles: ["Service.run"], source: true },
      })) as ToolResult,
    );
    assert.ok(
      expand.nodes.some((node) => (node.source ?? "").includes("helper(")),
      `symbol_details returns the run body: ${JSON.stringify(expand.nodes)}`,
    );
    assert.ok(
      expand.nodes.some(
        (node) =>
          node.sourceSpan?.file.endsWith("app.ts") &&
          typeof node.sourceSpan.startLine === "number",
      ),
      `symbol_details returns source line anchors: ${JSON.stringify(expand.nodes)}`,
    );
    assert.ok(
      expand.nodes.some((node) =>
        node.decorators?.some(
          (decorator) =>
            decorator.name === "Route" &&
            decorator.arguments.some((arg) => arg.literal === "/run"),
        ),
      ),
      `symbol_details returns decorator facts: ${JSON.stringify(expand.nodes)}`,
    );

    const expandShape = callJson<{
      nodes: {
        name: string;
        calls?: string[];
        flow?: string[];
        source?: string;
      }[];
    }>(
      (await client.request("tools/call", {
        name: "symbol_details",
        arguments: { handles: ["Service.run"] },
      })) as ToolResult,
    );
    assert.ok(
      expandShape.nodes.some(
        (node) =>
          node.name === "Service.run" &&
          node.calls?.some((call) => call === "helper") &&
          node.source === undefined,
      ),
      `symbol_details returns source-free direct call summaries: ${JSON.stringify(expandShape.nodes)}`,
    );
    assert.ok(
      expandShape.nodes.every((node) => node.flow === undefined),
      `symbol_details leaves execution paths to dependency_path: ${JSON.stringify(expandShape.nodes)}`,
    );

    const expandDeps = callJson<{
      nodes: {
        dependsOn?: { name: string; evidence?: { text?: string } }[];
        dependedOnBy?: unknown[];
      }[];
    }>(
      (await client.request("tools/call", {
        name: "symbol_details",
        arguments: {
          handles: ["Service.run"],
          neighbors: true,
          neighborLimit: 1,
        },
      })) as ToolResult,
    );
    assert.ok(
      expandDeps.nodes.some(
        (node) =>
          node.dependsOn?.some(
            (ref) =>
              ref.name === "helper" &&
              (ref.evidence?.text ?? "").includes("helper"),
          ) &&
          (node.dependsOn?.length ?? 0) <= 1 &&
          Array.isArray(node.dependedOnBy),
      ),
      `symbol_details returns dependency neighbors: ${JSON.stringify(expandDeps.nodes)}`,
    );

    const expandSourceDeps = callJson<{
      nodes: {
        source?: string;
        dependsOn?: {
          name: string;
          evidence?: { startLine?: number; text?: string };
        }[];
        dependedOnBy?: unknown[];
      }[];
    }>(
      (await client.request("tools/call", {
        name: "symbol_details",
        arguments: {
          handles: ["Service.run"],
          source: true,
          neighbors: true,
          neighborLimit: 10,
        },
      })) as ToolResult,
    );
    assert.ok(
      expandSourceDeps.nodes.some(
        (node) =>
          (node.source ?? "").includes("helper(") &&
          node.dependsOn === undefined &&
          node.dependedOnBy === undefined,
      ),
      `symbol_details keeps source reads separate from dependency maps: ${JSON.stringify(expandSourceDeps.nodes)}`,
    );
    assert.ok(
      expandSourceDeps.nodes.every((node) => node.dependsOn === undefined),
      `symbol_details ignores neighbors in source mode: ${JSON.stringify(expandSourceDeps.nodes)}`,
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

