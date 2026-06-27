import { TestProject } from "@ttsc/testing";

import { TtsgraphClient, assert } from "../internal/ttsgraph";

interface ToolResult {
  content: { type: string; text: string }[];
}

const callJson = <T>(result: ToolResult): T =>
  JSON.parse(result.content[0]?.text ?? "{}") as T;

const callGraphJson = <T>(result: ToolResult): T => {
  const value = callJson<{
    type?: string;
    entrypoints?: unknown;
    symbols?: unknown;
    trace?: unknown;
    details?: unknown;
    overview?: unknown;
  }>(result);
  switch (value.type) {
    case "find_question_entrypoints":
      return value.entrypoints as T;
    case "lookup_symbols":
      return value.symbols as T;
    case "trace_dependency_path":
      return value.trace as T;
    case "inspect_symbol_details":
      return value.details as T;
    case "summarize_project":
      return value.overview as T;
    default:
      throw new Error(`Unexpected graph result: ${JSON.stringify(value)}`);
  }
};

type GraphRequestType =
  | "find_question_entrypoints"
  | "lookup_symbols"
  | "trace_dependency_path"
  | "inspect_symbol_details"
  | "summarize_project";

interface GraphRequest {
  type: GraphRequestType;
  [key: string]: unknown;
}

const graphArguments = (props: {
  thinking: string;
  request: GraphRequest;
}) => ({
  question: props.thinking,
  graphNeed:
    "Use resident TypeScript graph evidence and avoid shell or web lookup.",
  draft: {
    type: props.request.type,
    reason: props.thinking,
  },
  review:
    "The draft is bounded to one graph request; follow-up evidence should use another graph call.",
  request: props.request,
});

/**
 * Verifies the @ttsc/graph launcher serves the redesigned graph tools to an MCP
 * client end to end over stdio.
 *
 * The TypeScript engine is unit-smoked in isolation; this case proves the
 * shipped pipeline works: the Node launcher spawns, runs `ttscgraph dump` once
 * for a real project, builds the resident graph, and answers
 * initialize/tools-list/tools-call for the single
 * inspect_typescript_project_graph_before_answering tool, then exits cleanly
 * when stdin closes.
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
      ["inspect_typescript_project_graph_before_answering"],
      `tools/list advertises the single graph tool, got ${names.join(", ")}`,
    );

    // question_entrypoints: the first source-free index resolves direct handles and
    // nearby dependency context.
    const index = callGraphJson<{
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
        name: "inspect_typescript_project_graph_before_answering",
        arguments: graphArguments({
          thinking:
            "Find source-free starting handles before tracing Service.run to helper.",
          request: {
            type: "find_question_entrypoints",
            purpose: "Resolve the starting method and nearby dependency edge.",
            query: "how Service.run reaches helper",
          },
        }),
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
    const overview = callGraphJson<{
      counts: { nodes: number; byKind: Record<string, number> };
      publicApi?: { id: string; name: string; line?: number }[];
    }>(
      (await client.request("tools/call", {
        name: "inspect_typescript_project_graph_before_answering",
        arguments: graphArguments({
          thinking: "Summarize project shape without reading source bodies.",
          request: {
            type: "summarize_project",
            purpose: "Verify the architecture overview request branch.",
            aspect: "all",
          },
        }),
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
    const query = callGraphJson<{
      hits: { id: string; name: string; kind: string }[];
      next: { expand: string[]; traceFrom: string[] };
    }>(
      (await client.request("tools/call", {
        name: "inspect_typescript_project_graph_before_answering",
        arguments: graphArguments({
          thinking: "Look up Service by exact symbol name.",
          request: {
            type: "lookup_symbols",
            purpose: "Resolve a specific class handle.",
            query: "Service",
          },
        }),
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
    const methodQuery = callGraphJson<{
      hits: { name: string; kind: string }[];
    }>(
      (await client.request("tools/call", {
        name: "inspect_typescript_project_graph_before_answering",
        arguments: graphArguments({
          thinking:
            "Look up the explicit run method before dependency tracing.",
          request: {
            type: "lookup_symbols",
            purpose: "Rank the method target ahead of the class.",
            query: "How does the `run` method reach helper?",
            limit: 3,
          },
        }),
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
    const trace = callGraphJson<{
      reached: { name: string }[];
      hops: { evidence?: { text?: string } }[];
      steps?: string[];
    }>(
      (await client.request("tools/call", {
        name: "inspect_typescript_project_graph_before_answering",
        arguments: graphArguments({
          thinking:
            "Trace execution dependencies from run to confirm the helper call.",
          request: {
            type: "trace_dependency_path",
            purpose: "Follow outgoing runtime calls from Service.run.",
            from: "run",
            direction: "forward",
            focus: "execution",
          },
        }),
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
    const pathTrace = callGraphJson<{
      path?: { name: string; signature?: string }[];
      steps?: string[];
      next?: { traceFrom: string[] };
    }>(
      (await client.request("tools/call", {
        name: "inspect_typescript_project_graph_before_answering",
        arguments: graphArguments({
          thinking: "Ask for the direct path from Service.run to helper.",
          request: {
            type: "trace_dependency_path",
            purpose: "Verify dotted handles work in path mode.",
            from: "Service.run",
            to: "helper",
          },
        }),
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
    const expand = callGraphJson<{
      nodes: {
        id: string;
        name: string;
        source?: string;
        sourceLines?: { line: number; text: string }[];
        sourceSpan?: { file: string; startLine: number; endLine?: number };
        decorators?: { name: string; arguments: { literal?: unknown }[] }[];
      }[];
      unknown: string[];
    }>(
      (await client.request("tools/call", {
        name: "inspect_typescript_project_graph_before_answering",
        arguments: graphArguments({
          thinking:
            "Read only the Service.run body because the implementation contains the decisive helper call.",
          request: {
            type: "inspect_symbol_details",
            purpose: "Narrow source read for the selected method.",
            handles: ["Service.run"],
            source: true,
            lineNumbers: true,
          },
        }),
      })) as ToolResult,
    );
    assert.ok(
      expand.nodes.some((node) => (node.source ?? "").includes("helper(")),
      `symbol_details returns the run body: ${JSON.stringify(expand.nodes)}`,
    );
    assert.ok(
      expand.nodes.some((node) =>
        node.sourceLines?.some(
          (line) =>
            typeof line.line === "number" && line.text.includes("helper();"),
        ),
      ),
      `symbol_details returns numbered source lines: ${JSON.stringify(expand.nodes)}`,
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

    const expandShape = callGraphJson<{
      nodes: {
        name: string;
        calls?: string[];
        flow?: string[];
        source?: string;
      }[];
    }>(
      (await client.request("tools/call", {
        name: "inspect_typescript_project_graph_before_answering",
        arguments: graphArguments({
          thinking: "Inspect Service.run shape without reading source.",
          request: {
            type: "inspect_symbol_details",
            purpose: "Verify source-free direct call summaries.",
            handles: ["Service.run"],
          },
        }),
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

    const expandDeps = callGraphJson<{
      nodes: {
        dependsOn?: { name: string; evidence?: { text?: string } }[];
        dependedOnBy?: unknown[];
      }[];
    }>(
      (await client.request("tools/call", {
        name: "inspect_typescript_project_graph_before_answering",
        arguments: graphArguments({
          thinking:
            "Map immediate Service.run dependencies without source bodies.",
          request: {
            type: "inspect_symbol_details",
            purpose: "Verify bounded neighbor mapping.",
            handles: ["Service.run"],
            neighbors: true,
            neighborLimit: 1,
          },
        }),
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

    const expandSourceDeps = callGraphJson<{
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
        name: "inspect_typescript_project_graph_before_answering",
        arguments: graphArguments({
          thinking:
            "Read Service.run source and verify neighbor options stay ignored in source mode.",
          request: {
            type: "inspect_symbol_details",
            purpose: "Source reads must stay separate from dependency maps.",
            handles: ["Service.run"],
            source: true,
            neighbors: true,
            neighborLimit: 10,
          },
        }),
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
