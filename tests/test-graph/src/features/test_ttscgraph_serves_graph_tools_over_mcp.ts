import { TestProject } from "@ttsc/testing";

import { TtsgraphClient, assert } from "../internal/ttsgraph";

interface ToolResult {
  content: { type: string; text: string }[];
  structuredContent?: unknown;
}

const callJson = <T>(result: ToolResult): T =>
  (result.structuredContent ?? {}) as T;

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
    case "tour":
    case "escape":
      return value.result as T;
    default:
      throw new Error(`Unexpected graph result: ${JSON.stringify(value)}`);
  }
};

interface GraphNext {
  action: "answer" | "inspect" | "outside" | "clarify";
  request?: string;
  reason: string;
}

const callGraphNext = (result: ToolResult): GraphNext => {
  const value = callJson<{ next?: GraphNext }>(result);
  if (
    value.next === undefined ||
    typeof value.next.action !== "string" ||
    typeof value.next.reason !== "string"
  ) {
    throw new Error(`Missing wrapper next: ${JSON.stringify(value)}`);
  }
  return value.next;
};

const GRAPH_TOOL_NAME = "inspect_typescript_graph";

type GraphRequestType =
  | "entrypoints"
  | "lookup"
  | "trace"
  | "details"
  | "overview"
  | "tour"
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
  draft: {
    reason:
      props.request.type === "escape"
        ? "The next evidence is outside the indexed TypeScript graph."
        : "The smallest useful sacred graph step.",
    type: props.request.type,
  },
  review:
    props.request.type === "escape"
      ? "Confirmed: skip graph work and return escape."
      : "Confirmed: keep this final request; do not replace graph facts with file reads.",
  request: props.request,
});

/**
 * Verifies the @ttsc/graph launcher serves the redesigned graph tools to an MCP
 * client end to end over stdio.
 *
 * The TypeScript engine is unit-smoked in isolation; this case proves the
 * shipped pipeline works: the Node launcher spawns, runs `ttscgraph dump` once
 * for a real project, builds the resident graph, and answers
 * initialize/tools-list/tools-call for the single source-flow tool, then exits
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
    "node_modules/external-lib/index.d.ts": [
      "export interface ExternalThing {",
      "  id: string;",
      "}",
      "",
    ].join("\n"),
    "src/app.ts": [
      "import type { ExternalThing } from 'external-lib';",
      "",
      "function Route(path: string): MethodDecorator {",
      "  return () => undefined;",
      "}",
      "export type ExternalAlias = ExternalThing;",
      "export function log(): void {}",
      "export function helper(): void {}",
      "export interface Runner {",
      "  run(): void;",
      "}",
      "export class Service implements Runner {",
      "  @Route('/run')",
      "  run(): void {",
      "    helper();",
      "    other();",
      "    third();",
      "    fourth();",
      "    fifth();",
      "    log();",
      "  }",
      "}",
      "export function other(): void {}",
      "export function third(): void {}",
      "export function fourth(): void {}",
      "export function fifth(): void {}",
      // Twelve extra call sites make `log` a shared fan-in hub (in-degree >= 12)
      // that drives nothing onward (out-degree 0). Service.run calls both `log`
      // and `helper` directly, so the tour must prune the hub `log` from the flow
      // while keeping `helper`, a genuine step at the same depth.
      ...Array.from(
        { length: 12 },
        (_unused, i) => `export function caller${i}(): void { log(); }`,
      ),
      "export const adapter = {",
      "  run: () => helper(),",
      "  reset() {",
      "    other();",
      "  },",
      "};",
      "",
    ].join("\n"),
    "src/app.spec.ts": [
      "import { Service } from './app';",
      "",
      "export function coversRun(): void {",
      "  new Service().run();",
      "}",
      "",
    ].join("\n"),
  });

  const withClient = async (
    body: (client: ReturnType<typeof TtsgraphClient.start>) => Promise<void>,
  ): Promise<void> => {
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
        [GRAPH_TOOL_NAME],
        `tools/list advertises the single graph tool, got ${names.join(", ")}`,
      );
      await body(client);
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

  await withClient(async (client) => {
    const skipRaw = (await client.request("tools/call", {
      name: GRAPH_TOOL_NAME,
      arguments: graphArguments({
        thinking:
          "The question has already been answered by prior evidence, so no graph operation should run.",
        request: {
          type: "escape",
          reason: "No additional TypeScript graph evidence is needed.",
          nextStep: "Answer from the existing evidence.",
        },
      }),
    })) as ToolResult;
    const skip = callJson<{
      result?: {
        type?: string;
        skipped?: boolean;
        reason?: string;
        nextStep?: string;
      };
    }>(skipRaw);
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
    assert.equal(
      callGraphNext(skipRaw).action,
      "outside",
      `escape carries an outside wrapper next: ${JSON.stringify(callGraphNext(skipRaw))}`,
    );

    // entrypoints: the first source-free result resolves direct handles and
    // nearby dependency context.
    const entrypointsRaw = (await client.request("tools/call", {
      name: GRAPH_TOOL_NAME,
      arguments: graphArguments({
        thinking:
          "Find source-free starting handles before tracing Service.run to helper.",
        request: {
          type: "entrypoints",
          query: "how Service.run reaches helper",
          neighbors: 1,
        },
      }),
    })) as ToolResult;
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
    }>(entrypointsRaw);
    const entrypointsNext = callGraphNext(entrypointsRaw);
    assert.ok(
      entrypointsNext.action === "inspect" &&
        entrypointsNext.request === "trace",
      `entrypoints returns an inspect/trace wrapper next: ${JSON.stringify(entrypointsNext)}`,
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
      entrypointRun !== undefined,
      `entrypoints resolves the Service.run handle: ${JSON.stringify(entrypoints.hits)}`,
    );

    // tour: one answer-ready onboarding slice with flow, tests, and anchors.
    const tour = callGraphJson<{
      entrypoints: { name: string; signature?: string }[];
      primaryFlow: {
        start: { name: string };
        steps: string[];
        reached: { id: string; name: string }[];
        anchors: { file: string; startLine: number; source?: string }[];
      }[];
      tests: { file: string; startLine: number; source?: string }[];
      answerAnchors: { file: string; startLine: number; source?: string }[];
    }>(
      (await client.request("tools/call", {
        name: GRAPH_TOOL_NAME,
        arguments: graphArguments({
          // The tour asks for no question of its own: it ranks against the one
          // the caller already wrote, which `graphArguments` puts in `question`.
          thinking:
            "I'm new here; trace Service.run to the work it does and show tests to read next.",
          request: {
            type: "tour",
            reinterpretations: ["Service.run", "helper"],
          },
        }),
      })) as ToolResult,
    );
    assert.ok(
      tour.entrypoints.some((node) => node.name === "Service.run"),
      `tour includes central entrypoints: ${JSON.stringify(tour.entrypoints)}`,
    );
    // A step is prose: it names both of its ends and the file and line the call
    // sits on, but it carries no handle. So every node the flow reached is listed
    // with its id, including the ones the steps name — that id is what a second
    // call is made with.
    assert.ok(
      tour.primaryFlow.some(
        (flow) =>
          flow.start.name === "Service.run" &&
          flow.steps.some((step) => step.includes("helper")) &&
          flow.reached.some(
            (node) => node.name === "helper" && node.id.includes("app.ts#"),
          ),
      ),
      `tour includes source-free primary flow with handles: ${JSON.stringify(tour.primaryFlow)}`,
    );
    assert.ok(
      tour.primaryFlow.every(
        (flow) =>
          !flow.reached.some((node) => node.name === "log") &&
          !flow.steps.some((step) => /-> log\b/.test(step)),
      ),
      `tour prunes the shared fan-in hub 'log' from the flow: ${JSON.stringify(tour.primaryFlow)}`,
    );
    assert.ok(
      tour.tests.some((anchor) => anchor.file.endsWith("app.spec.ts")),
      `tour includes test anchors: ${JSON.stringify(tour.tests)}`,
    );
    assert.ok(
      tour.answerAnchors.some(
        (anchor) =>
          anchor.file.endsWith("app.ts") &&
          typeof anchor.startLine === "number" &&
          anchor.source === undefined,
      ),
      `tour returns answer anchors, not source text: ${JSON.stringify(tour.answerAnchors)}`,
    );

    // overview: a compact architecture map with real counts.
    const overviewRaw = (await client.request("tools/call", {
      name: GRAPH_TOOL_NAME,
      arguments: graphArguments({
        thinking: "Summarize project shape from graph index facts.",
        request: {
          type: "overview",
          aspect: "all",
        },
      }),
    })) as ToolResult;
    const overview = callGraphJson<{
      counts: { nodes: number; byKind: Record<string, number> };
      publicApi?: { id: string; name: string; line?: number }[];
    }>(overviewRaw);
    assert.equal(
      callGraphNext(overviewRaw).action,
      "answer",
      `overview carries an answer wrapper next: ${JSON.stringify(callGraphNext(overviewRaw))}`,
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
    const lookupRaw = (await client.request("tools/call", {
      name: GRAPH_TOOL_NAME,
      arguments: graphArguments({
        thinking: "Look up Service by exact symbol name.",
        request: {
          type: "lookup",
          query: "Service",
        },
      }),
    })) as ToolResult;
    const lookup = callGraphJson<{
      hits: { id: string; name: string; kind: string }[];
    }>(lookupRaw);
    const service = lookup.hits.find((hit) => hit.name === "Service");
    assert.ok(service, `lookup finds Service: ${JSON.stringify(lookup.hits)}`);
    assert.equal(
      callGraphNext(lookupRaw).action,
      "answer",
      `a resolved lookup carries an answer wrapper next: ${JSON.stringify(callGraphNext(lookupRaw))}`,
    );
    const methodQuery = callGraphJson<{
      hits: { name: string; kind: string }[];
    }>(
      (await client.request("tools/call", {
        name: GRAPH_TOOL_NAME,
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

    const projectOnlyLookup = callGraphJson<{
      hits: { name: string; file: string }[];
    }>(
      (await client.request("tools/call", {
        name: GRAPH_TOOL_NAME,
        arguments: graphArguments({
          thinking: "Look up ExternalThing without crossing into dependencies.",
          request: {
            type: "lookup",
            query: "ExternalThing",
          },
        }),
      })) as ToolResult,
    );
    assert.ok(
      projectOnlyLookup.hits.every((hit) => !hit.file.includes("node_modules")),
      `lookup excludes external dependency declarations by default: ${JSON.stringify(projectOnlyLookup.hits)}`,
    );

    const externalLookup = callGraphJson<{
      hits: { name: string; file: string }[];
    }>(
      (await client.request("tools/call", {
        name: GRAPH_TOOL_NAME,
        arguments: graphArguments({
          thinking:
            "Look up ExternalThing as an explicit dependency-boundary type.",
          request: {
            type: "lookup",
            query: "ExternalThing",
            includeExternal: true,
          },
        }),
      })) as ToolResult,
    );
    assert.ok(
      externalLookup.hits.some(
        (hit) =>
          hit.name === "ExternalThing" && hit.file.includes("node_modules"),
      ),
      `lookup includes external declarations when requested: ${JSON.stringify(externalLookup.hits)}`,
    );

    // trace: forward from Service.run reaches the helper it calls.
    const trace = callGraphJson<{
      reached: { name: string; sourceSpan?: { file: string } }[];
      hops: {
        evidence?: { file?: string; startLine?: number; text?: string };
      }[];
      steps?: string[];
    }>(
      (await client.request("tools/call", {
        name: GRAPH_TOOL_NAME,
        arguments: graphArguments({
          thinking:
            "Trace execution dependencies from run to confirm the helper call.",
          request: {
            type: "trace",
            from: entrypointRun.id,
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
      trace.reached.some((node) => node.sourceSpan?.file.endsWith("app.ts")),
      `trace nodes carry source ranges: ${JSON.stringify(trace.reached)}`,
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

    // impact: caller surfaces prioritize tests and still return ranges.
    const impact = callGraphJson<{
      reached: {
        name: string;
        file: string;
        roles?: string[];
        sourceSpan?: { file: string; startLine: number };
      }[];
    }>(
      (await client.request("tools/call", {
        name: GRAPH_TOOL_NAME,
        arguments: graphArguments({
          thinking:
            "Trace callers that would be affected by changing Service.run.",
          request: {
            type: "trace",
            from: "Service.run",
            direction: "impact",
            focus: "execution",
          },
        }),
      })) as ToolResult,
    );
    assert.ok(
      impact.reached.some(
        (node) =>
          node.roles?.includes("test") &&
          node.file.endsWith("app.spec.ts") &&
          typeof node.sourceSpan?.startLine === "number",
      ),
      `impact trace returns test range anchors: ${JSON.stringify(impact.reached)}`,
    );

    // trace path mode: dotted from handles can be used directly.
    const pathTrace = callGraphJson<{
      path?: { name: string; signature?: string }[];
      steps?: string[];
    }>(
      (await client.request("tools/call", {
        name: GRAPH_TOOL_NAME,
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
      pathTrace.steps?.some((step) => step.includes("helper")),
      `trace path returns step text: ${JSON.stringify(pathTrace.steps)}`,
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
        name: GRAPH_TOOL_NAME,
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
        name: GRAPH_TOOL_NAME,
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
        name: GRAPH_TOOL_NAME,
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
        name: GRAPH_TOOL_NAME,
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

    const interfaceDetails = callGraphJson<{
      nodes: {
        name: string;
        implementedBy?: { name: string; relation: string; file: string }[];
      }[];
    }>(
      (await client.request("tools/call", {
        name: GRAPH_TOOL_NAME,
        arguments: graphArguments({
          thinking:
            "Inspect an interface member and get its concrete implementation candidates.",
          request: {
            type: "details",
            handles: ["Runner.run"],
          },
        }),
      })) as ToolResult,
    );
    assert.ok(
      interfaceDetails.nodes.some(
        (node) =>
          node.name === "Runner.run" &&
          node.implementedBy?.some(
            (ref) =>
              ref.name === "Service.run" &&
              ref.relation === "implements" &&
              ref.file.endsWith("app.ts"),
          ),
      ),
      `details returns implementation candidates: ${JSON.stringify(interfaceDetails.nodes)}`,
    );
  });
};
