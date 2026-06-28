import { TestProject } from "@ttsc/testing";

import { TtsgraphClient, assert } from "../internal/ttsgraph";

interface ToolResult {
  content: { type: string; text: string }[];
}

const callJson = <T>(result: ToolResult): T =>
  JSON.parse(result.content[0]?.text ?? "{}") as T;

const callGraphJson = <T>(result: ToolResult): T => {
  const value = callJson<{
    result?: {
      type?: string;
    };
  }>(result);
  switch (value.result?.type) {
    case "entrypoints":
    case "lookup":
    case "trace":
    case "details":
    case "overview":
    case "escape":
      return value.result as T;
    default:
      throw new Error(`Unexpected graph result: ${JSON.stringify(value)}`);
  }
};

type GraphRequestType =
  | "entrypoints"
  | "lookup"
  | "trace"
  | "details"
  | "overview"
  | "escape";

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
    reason: props.thinking,
    type: props.request.type,
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
 * initialize/tools-list/tools-call for the single query tool, then exits
 * cleanly when stdin closes.
 *
 * 1. Materialize a project with a Service.run -> helper call chain, then spawn the
 *    launcher against it.
 * 2. Drive initialize, tools/list, and a call to each request branch.
 * 3. Assert the entrypoints, architecture counts, a lookup hit, forward/path
 *    traces reaching the callee, source-free details, and a clean exit.
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
      "export const adapter = {",
      "  run: () => helper(),",
      "  reset() {",
      "    other();",
      "  },",
      "};",
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
      ["query"],
      `tools/list advertises the single graph tool, got ${names.join(", ")}`,
    );

    const skip = callJson<{
      result?: {
        type?: string;
        skipped?: boolean;
        reason?: string;
        nextStep?: string;
      };
    }>(
      (await client.request("tools/call", {
        name: "query",
        arguments: graphArguments({
          thinking:
            "The question has already been answered by prior evidence, so no graph operation should run.",
          request: {
            type: "escape",
            reason: "No additional TypeScript graph evidence is needed.",
            nextStep: "Answer from the existing evidence.",
          },
        }),
      })) as ToolResult,
    );
    assert.equal(
      skip.result?.type,
      "escape",
      `escape returns its own result branch: ${JSON.stringify(skip)}`,
    );
    assert.equal(
      skip.result?.skipped,
      true,
      `escape marks the operation skipped: ${JSON.stringify(skip)}`,
    );

    // entrypoints: the first source-free result resolves direct handles and
    // nearby dependency context.
    const entrypoints = callGraphJson<{
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
          evidence?: { file?: string; startLine?: number; text?: string };
        }[];
      }[];
      next: { details: string[]; traceFrom: string[] };
    }>(
      (await client.request("tools/call", {
        name: "query",
        arguments: graphArguments({
          thinking:
            "Find source-free starting handles before tracing Service.run to helper.",
          request: {
            type: "entrypoints",
            query: "how Service.run reaches helper",
            neighbors: 1,
          },
        }),
      })) as ToolResult,
    );
    assert.ok(
      entrypoints.hits.some(
        (hit) =>
          hit.name === "Service.run" &&
          (hit.signature ?? "").includes("run(): void"),
      ),
      `entrypoints ranks Service.run with a signature: ${JSON.stringify(entrypoints.hits)}`,
    );
    assert.ok(
      entrypoints.hits.some(
        (hit) =>
          hit.name === "Service.run" &&
          hit.decorators?.some(
            (decorator) =>
              decorator.name === "Route" &&
              decorator.arguments.some((arg) => arg.literal === "/run"),
          ),
      ),
      `entrypoints carries decorator facts: ${JSON.stringify(entrypoints.hits)}`,
    );
    assert.ok(
      entrypoints.mentions.some(
        (mention) =>
          mention.handle === "Service.run" &&
          mention.node?.name === "Service.run",
      ),
      `entrypoints resolves direct dotted mentions: ${JSON.stringify(entrypoints.mentions)}`,
    );
    assert.ok(
      entrypoints.neighborhood.some(
        (node) =>
          node.name === "Service.run" &&
          node.dependsOn.some(
            (ref) =>
              ref.name === "helper" &&
              typeof ref.evidence?.startLine === "number" &&
              ref.evidence.file?.endsWith("app.ts") &&
              ref.evidence.text === undefined,
          ),
      ),
      `entrypoints includes span-only dependency evidence: ${JSON.stringify(entrypoints.neighborhood)}`,
    );
    const entrypointRun = entrypoints.hits.find(
      (hit) => hit.name === "Service.run",
    );
    assert.ok(
      entrypointRun !== undefined &&
        entrypoints.next.details.includes(entrypointRun.id) &&
        entrypoints.next.traceFrom.includes(entrypointRun.id),
      `entrypoints returns follow-up handles for ranked seeds: ${JSON.stringify(entrypoints.next)}`,
    );

    // overview: a compact architecture map with real counts.
    const overview = callGraphJson<{
      counts: { nodes: number; byKind: Record<string, number> };
      publicApi?: { id: string; name: string; line?: number }[];
    }>(
      (await client.request("tools/call", {
        name: "query",
        arguments: graphArguments({
          thinking: "Summarize project shape from graph index facts.",
          request: {
            type: "overview",
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
      `overview returns architecture counts: ${JSON.stringify(overview.counts)}`,
    );
    assert.ok(
      overview.publicApi?.some(
        (api) =>
          api.name === "Service" && api.id.length > 0 && api.line !== undefined,
      ),
      `overview returns public API handles: ${JSON.stringify(overview.publicApi)}`,
    );

    // lookup: finds Service by name and ranks explicit method queries.
    const lookup = callGraphJson<{
      hits: { id: string; name: string; kind: string }[];
      next: { details: string[]; traceFrom: string[] };
    }>(
      (await client.request("tools/call", {
        name: "query",
        arguments: graphArguments({
          thinking: "Look up Service by exact symbol name.",
          request: {
            type: "lookup",
            query: "Service",
          },
        }),
      })) as ToolResult,
    );
    const service = lookup.hits.find((hit) => hit.name === "Service");
    assert.ok(service, `lookup finds Service: ${JSON.stringify(lookup.hits)}`);
    assert.ok(
      lookup.next.details.includes(service.id) &&
        lookup.next.traceFrom.includes(service.id),
      `lookup returns follow-up handles: ${JSON.stringify(lookup.next)}`,
    );
    const methodQuery = callGraphJson<{
      hits: { name: string; kind: string }[];
    }>(
      (await client.request("tools/call", {
        name: "query",
        arguments: graphArguments({
          thinking:
            "Look up the explicit run method before dependency tracing.",
          request: {
            type: "lookup",
            query: "How does the `run` method reach helper?",
            limit: 3,
          },
        }),
      })) as ToolResult,
    );
    assert.equal(
      methodQuery.hits[0]?.name,
      "Service.run",
      `lookup ranks the explicit method target first: ${JSON.stringify(methodQuery.hits)}`,
    );
    assert.equal(
      methodQuery.hits[0]?.kind,
      "method",
      `lookup preserves the method kind: ${JSON.stringify(methodQuery.hits)}`,
    );

    // trace: forward from Service.run reaches the helper it calls.
    const trace = callGraphJson<{
      reached: { name: string }[];
      hops: {
        evidence?: { file?: string; startLine?: number; text?: string };
      }[];
      steps?: string[];
    }>(
      (await client.request("tools/call", {
        name: "query",
        arguments: graphArguments({
          thinking:
            "Trace execution dependencies from run to confirm the helper call.",
          request: {
            type: "trace",
            from: "run",
            direction: "forward",
            focus: "execution",
          },
        }),
      })) as ToolResult,
    );
    assert.ok(
      trace.reached.some((node) => node.name === "helper"),
      `trace forward reaches helper: ${JSON.stringify(trace.reached)}`,
    );
    assert.ok(
      trace.hops.some(
        (hop) =>
          hop.evidence?.file?.endsWith("app.ts") &&
          typeof hop.evidence.startLine === "number" &&
          hop.evidence.text === undefined,
      ),
      `trace forward carries span-only hop evidence: ${JSON.stringify(trace.hops)}`,
    );
    assert.ok(
      trace.steps?.some((step) => step.includes("Service.run")),
      `trace returns compact step text: ${JSON.stringify(trace.steps)}`,
    );

    // trace path mode: dotted from handles can be used directly.
    const pathTrace = callGraphJson<{
      path?: { name: string; signature?: string }[];
      steps?: string[];
      next?: { traceFrom: string[] };
    }>(
      (await client.request("tools/call", {
        name: "query",
        arguments: graphArguments({
          thinking: "Ask for the direct path from Service.run to helper.",
          request: {
            type: "trace",
            from: "Service.run",
            to: "helper",
          },
        }),
      })) as ToolResult,
    );
    assert.ok(
      pathTrace.path?.some((node) => node.name === "helper"),
      `trace path reaches helper from dotted handle: ${JSON.stringify(pathTrace.path)}`,
    );
    assert.ok(
      pathTrace.path?.some((node) =>
        (node.signature ?? "").includes("run(): void"),
      ),
      `trace path carries signatures: ${JSON.stringify(pathTrace.path)}`,
    );
    assert.ok(
      pathTrace.steps?.some((step) => step.includes("helper")) &&
        (pathTrace.next?.traceFrom.length ?? 0) > 0,
      `trace path returns step text and continuation handles: ${JSON.stringify(pathTrace)}`,
    );

    // details: returns declared shape and anchors, not implementation text.
    const details = callGraphJson<{
      nodes: {
        id: string;
        name: string;
        calls?: {
          name: string;
          relation: string;
          evidence?: { file?: string; startLine?: number };
        }[];
        sourceSpan?: { file: string; startLine: number; endLine?: number };
        decorators?: { name: string; arguments: { literal?: unknown }[] }[];
        members?: { name: string; kind: string; signature?: string }[];
      }[];
      unknown: string[];
    }>(
      (await client.request("tools/call", {
        name: "query",
        arguments: graphArguments({
          thinking: "Inspect Service.run shape without reading source.",
          request: {
            type: "details",
            handles: ["Service.run"],
          },
        }),
      })) as ToolResult,
    );
    assert.ok(
      details.nodes.some(
        (node) =>
          node.name === "Service.run" &&
          node.calls?.some(
            (call) =>
              call.name === "helper" &&
              call.relation === "calls" &&
              call.evidence?.file?.endsWith("app.ts"),
          ) &&
          Object.hasOwn(node, "source") === false,
      ),
      `details returns source-free direct call references: ${JSON.stringify(details.nodes)}`,
    );
    assert.ok(
      details.nodes.some(
        (node) =>
          node.sourceSpan?.file.endsWith("app.ts") &&
          typeof node.sourceSpan.startLine === "number",
      ),
      `details returns source line anchors: ${JSON.stringify(details.nodes)}`,
    );
    assert.ok(
      details.nodes.some((node) =>
        node.decorators?.some(
          (decorator) =>
            decorator.name === "Route" &&
            decorator.arguments.some((arg) => arg.literal === "/run"),
        ),
      ),
      `details returns decorator facts: ${JSON.stringify(details.nodes)}`,
    );

    const objectDetails = callGraphJson<{
      nodes: {
        name: string;
        members?: { name: string; kind: string; signature?: string }[];
      }[];
    }>(
      (await client.request("tools/call", {
        name: "query",
        arguments: graphArguments({
          thinking: "Inspect adapter object outline without reading source.",
          request: {
            type: "details",
            handles: ["adapter"],
          },
        }),
      })) as ToolResult,
    );
    assert.ok(
      objectDetails.nodes.some(
        (node) =>
          node.name === "adapter" &&
          node.members?.some(
            (member) =>
              member.name === "run" &&
              member.kind === "property" &&
              member.signature?.includes("=>"),
          ),
      ),
      `details returns object-literal member outlines: ${JSON.stringify(objectDetails.nodes)}`,
    );

    const detailsShape = callGraphJson<{
      nodes: {
        name: string;
        calls?: { name: string; evidence?: { startLine?: number } }[];
        flow?: string[];
      }[];
    }>(
      (await client.request("tools/call", {
        name: "query",
        arguments: graphArguments({
          thinking: "Inspect Service.run shape without reading source.",
          request: {
            type: "details",
            handles: ["Service.run"],
          },
        }),
      })) as ToolResult,
    );
    assert.ok(
      detailsShape.nodes.some(
        (node) =>
          node.name === "Service.run" &&
          node.calls?.some(
            (call) =>
              call.name === "helper" &&
              typeof call.evidence?.startLine === "number",
          ) &&
          Object.hasOwn(node, "source") === false,
      ),
      `details returns source-free direct call references: ${JSON.stringify(detailsShape.nodes)}`,
    );
    assert.ok(
      detailsShape.nodes.every((node) => node.flow === undefined),
      `details leaves execution paths to trace: ${JSON.stringify(detailsShape.nodes)}`,
    );

    const detailsDeps = callGraphJson<{
      nodes: {
        dependsOn?: {
          name: string;
          evidence?: { file?: string; startLine?: number; text?: string };
        }[];
        dependedOnBy?: unknown[];
      }[];
    }>(
      (await client.request("tools/call", {
        name: "query",
        arguments: graphArguments({
          thinking: "Map immediate Service.run dependencies as graph ranges.",
          request: {
            type: "details",
            handles: ["Service.run"],
            neighbors: true,
            neighborLimit: 1,
          },
        }),
      })) as ToolResult,
    );
    assert.ok(
      detailsDeps.nodes.some(
        (node) =>
          node.dependsOn?.some(
            (ref) =>
              ref.name === "helper" &&
              ref.evidence?.file?.endsWith("app.ts") &&
              typeof ref.evidence.startLine === "number" &&
              ref.evidence.text === undefined,
          ) &&
          (node.dependsOn?.length ?? 0) <= 1 &&
          Array.isArray(node.dependedOnBy),
      ),
      `details returns dependency neighbors: ${JSON.stringify(detailsDeps.nodes)}`,
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
