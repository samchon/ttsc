import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";

type Client = { request(method: string, params: unknown): Promise<unknown> };
const graphPackage = JSON.parse(
  fs.readFileSync(
    createRequire(import.meta.url).resolve("@ttsc/graph/package.json"),
    "utf8",
  ),
) as { version: string };

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
 * Carries the full native MCP branch population on the existing shared client.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual initialize identity/guidance, sole-tool advertisement and escape/entrypoints/tour/overview/lookup/trace/path/impact/details replies retain every original assertion, including decorators, roles, range-only projection, exclusions and bounded neighbors.
 * @evidence contracts/testing.md#independent-expectations Authored McpService/mcpHelper/direct-call/test/hub declarations and literal tool/DTO expectations prescribe the facts independently of extraction; initialization version is the actual package metadata contract.
 * @evidence contracts/testing.md#distinguishing-cases Warm escape differs from populated queries, default external exclusion from opt-in, direct helper from terminal fan-in hub, and source-free method/object/member-implementation facts from source-body leakage.
 * @evidence contracts/testing.md#execution-ownership The selected graph entry passes its actual initial response and same resident client once. Queries create no scene project, scoped compiler profile, launcher or host.
 * @evidence contracts/e2e.md#necessary-boundary Native checker facts, application projection and actual MCP wire replies must agree; portable source policy cannot establish those actual responses.
 * @evidence contracts/e2e.md#shared-execution Distinct McpService input names and its unchanged local DAG join the one upfront population. All branch queries borrow that same snapshot; there is no former two-file profile preparation or selection loop.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity This helper issues readonly requests and warm escape only. The caller owns source mutations, transport authority and actual close receipts; terminal/recursive closed-universe variants are not merged or certified here.
 * @evidence contracts/e2e.md#preserved-coverage The overview retains its bounded public-API handle/anchor contract while the existing exact lookup owns McpService identity and source anchor; the original small-profile assumption that McpService must rank in a larger top15 is corrected. Other original MCP assertions remain against actual queries; the method decorator fixture adopts the shared standard decorator signature while preserving McpRoute('/run') metadata and call topology. These authored expectations may reveal unrelated-population conflicts in final CI; no passing result or global-universe equivalence is asserted.
 */
export async function assertGraphMcpCorpus(
  client: Client,
  initialization: unknown,
): Promise<void> {
  const init = initialization as {
    serverInfo?: { name?: string; version?: string };
    instructions?: string;
  };
  assert.equal(
    init.serverInfo?.name,
    "ttsc-graph",
    "initialize returns the server name",
  );
  assert.equal(
    init.serverInfo?.version,
    graphPackage.version,
    "initialize reports the installed graph package version",
  );
  assert.ok(
    typeof init.instructions === "string" && init.instructions.length > 0,
    "initialize ships usage guidance",
  );

  const list = (await client.request("tools/list", {})) as {
    tools: { name: string }[];
  };
  const names = list.tools.map((tool) => tool.name);
  assert.deepEqual(
    names,
    [GRAPH_TOOL_NAME],
    `tools/list advertises the single graph tool, got ${names.join(", ")}`,
  );
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
        "Find source-free starting handles before tracing McpService.run to mcpHelper.",
      request: {
        type: "entrypoints",
        query: "how McpService.run reaches mcpHelper",
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
    entrypointsNext.action === "inspect" && entrypointsNext.request === "trace",
    `entrypoints returns an inspect/trace wrapper next: ${JSON.stringify(entrypointsNext)}`,
  );
  assert.ok(
    entrypoints.hits.some(
      (hit) =>
        hit.name === "McpService.run" &&
        (hit.signature ?? "").includes("run(): void"),
    ),
    `entrypoints ranks McpService.run with a signature: ${JSON.stringify(entrypoints.hits)}`,
  );
  assert.ok(
    entrypoints.hits.some(
      (hit) =>
        hit.name === "McpService.run" &&
        hit.decorators?.some(
          (decorator) =>
            decorator.name === "McpRoute" &&
            decorator.arguments.some((arg) => arg.literal === "/run"),
        ),
    ),
    `entrypoints carries decorator facts: ${JSON.stringify(entrypoints.hits)}`,
  );
  assert.ok(
    entrypoints.mentions.some(
      (mention) =>
        mention.handle === "McpService.run" &&
        mention.node?.name === "McpService.run",
    ),
    `entrypoints resolves direct dotted mentions: ${JSON.stringify(entrypoints.mentions)}`,
  );
  assert.ok(
    entrypoints.neighborhood.some(
      (node) =>
        node.name === "McpService.run" &&
        node.dependsOn.some(
          (ref) =>
            ref.name === "mcpHelper" &&
            typeof ref.evidence?.startLine === "number" &&
            ref.evidence.file?.endsWith("mcp-app.ts") &&
            ref.evidence.text === undefined,
        ),
    ),
    `entrypoints includes span-only dependency evidence: ${JSON.stringify(entrypoints.neighborhood)}`,
  );
  const entrypointRun = entrypoints.hits.find(
    (hit) => hit.name === "McpService.run",
  );
  assert.ok(
    entrypointRun !== undefined,
    `entrypoints resolves the McpService.run handle: ${JSON.stringify(entrypoints.hits)}`,
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
          "I'm new here; trace McpService.run to the work it does and show tests to read next.",
        request: {
          type: "tour",
          reinterpretations: ["McpService.run", "mcpHelper"],
        },
      }),
    })) as ToolResult,
  );
  assert.ok(
    tour.entrypoints.some((node) => node.name === "McpService.run"),
    `tour includes central entrypoints: ${JSON.stringify(tour.entrypoints)}`,
  );
  // A step is prose: it names both of its ends and the file and line the call
  // sits on, but it carries no handle. So every node the flow reached is listed
  // with its id, including the ones the steps name — that id is what a second
  // call is made with.
  assert.ok(
    tour.primaryFlow.some(
      (flow) =>
        flow.start.name === "McpService.run" &&
        flow.steps.some((step) => step.includes("mcpHelper")) &&
        flow.reached.some(
          (node) =>
            node.name === "mcpHelper" && node.id.includes("mcp-app.ts#"),
        ),
    ),
    `tour includes source-free primary flow with handles: ${JSON.stringify(tour.primaryFlow)}`,
  );
  assert.ok(
    tour.primaryFlow.every(
      (flow) =>
        !flow.reached.some((node) => node.name === "mcpLog") &&
        !flow.steps.some((step) => /-> mcpLog\b/.test(step)),
    ),
    `tour prunes the shared fan-in hub 'mcpLog' from the flow: ${JSON.stringify(tour.primaryFlow)}`,
  );
  assert.ok(
    tour.tests.some((anchor) => anchor.file.endsWith("mcp-app.spec.ts")),
    `tour includes test anchors: ${JSON.stringify(tour.tests)}`,
  );
  assert.ok(
    tour.answerAnchors.some(
      (anchor) =>
        anchor.file.endsWith("mcp-app.ts") &&
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
    Array.isArray(overview.publicApi) &&
      overview.publicApi.length > 0 &&
      overview.publicApi.length <= 15,
    "overview returns its bounded public API ranking, not every exported declaration",
  );
  for (const api of overview.publicApi)
    assert.ok(
      api.name.length > 0 && api.id.length > 0 && typeof api.line === "number",
      `ranked public API entries retain native handles and anchors: ${JSON.stringify(api)}`,
    );

  // lookup: finds McpService by name and ranks explicit method queries.
  const lookupRaw = (await client.request("tools/call", {
    name: GRAPH_TOOL_NAME,
    arguments: graphArguments({
      thinking: "Look up McpService by exact symbol name.",
      request: {
        type: "lookup",
        query: "McpService",
      },
    }),
  })) as ToolResult;
  const lookup = callGraphJson<{
    hits: { id: string; name: string; kind: string; line?: number }[];
  }>(lookupRaw);
  const service = lookup.hits.find((hit) => hit.name === "McpService");
  assert.ok(service, `lookup finds McpService: ${JSON.stringify(lookup.hits)}`);
  assert.equal(service.kind, "class");
  assert.ok(
    service.id.length > 0 && typeof service.line === "number",
    "the exact API lookup retains McpService handle and source anchor outside the overview ranking window",
  );
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
        thinking: "Look up the explicit run method before dependency tracing.",
        request: {
          type: "lookup",
          query: "How does the `run` method reach mcpHelper?",
          limit: 3,
        },
      }),
    })) as ToolResult,
  );
  assert.equal(
    methodQuery.hits[0]?.name,
    "McpService.run",
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
        thinking:
          "Look up McpExternalThing without crossing into dependencies.",
        request: {
          type: "lookup",
          query: "McpExternalThing",
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
          "Look up McpExternalThing as an explicit dependency-boundary type.",
        request: {
          type: "lookup",
          query: "McpExternalThing",
          includeExternal: true,
        },
      }),
    })) as ToolResult,
  );
  assert.ok(
    externalLookup.hits.some(
      (hit) =>
        hit.name === "McpExternalThing" && hit.file.includes("node_modules"),
    ),
    `lookup includes external declarations when requested: ${JSON.stringify(externalLookup.hits)}`,
  );

  // trace: forward from McpService.run reaches the mcpHelper it calls.
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
          "Trace execution dependencies from run to confirm the mcpHelper call.",
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
    trace.reached.some((node) => node.name === "mcpHelper"),
    `trace forward reaches mcpHelper: ${JSON.stringify(trace.reached)}`,
  );
  assert.ok(
    trace.reached.some((node) => node.sourceSpan?.file.endsWith("mcp-app.ts")),
    `trace nodes carry source ranges: ${JSON.stringify(trace.reached)}`,
  );
  assert.ok(
    trace.hops.some(
      (hop) =>
        hop.evidence?.file?.endsWith("mcp-app.ts") &&
        typeof hop.evidence.startLine === "number" &&
        hop.evidence.text === undefined,
    ),
    `trace forward carries span-only hop evidence: ${JSON.stringify(trace.hops)}`,
  );
  assert.ok(
    trace.steps?.some((step) => step.includes("McpService.run")),
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
          "Trace callers that would be affected by changing McpService.run.",
        request: {
          type: "trace",
          from: "McpService.run",
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
        node.file.endsWith("mcp-app.spec.ts") &&
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
        thinking: "Ask for the direct path from McpService.run to mcpHelper.",
        request: {
          type: "trace",
          from: "McpService.run",
          to: "mcpHelper",
        },
      }),
    })) as ToolResult,
  );
  assert.ok(
    pathTrace.path?.some((node) => node.name === "mcpHelper"),
    `trace path reaches mcpHelper from dotted handle: ${JSON.stringify(pathTrace.path)}`,
  );
  assert.ok(
    pathTrace.path?.some((node) =>
      (node.signature ?? "").includes("run(): void"),
    ),
    `trace path carries signatures: ${JSON.stringify(pathTrace.path)}`,
  );
  assert.ok(
    pathTrace.steps?.some((step) => step.includes("mcpHelper")),
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
        thinking: "Inspect McpService.run shape without reading source.",
        request: {
          type: "details",
          handles: ["McpService.run"],
        },
      }),
    })) as ToolResult,
  );
  assert.ok(
    details.nodes.some(
      (node) =>
        node.name === "McpService.run" &&
        node.calls?.some(
          (call) =>
            call.name === "mcpHelper" &&
            call.relation === "calls" &&
            call.evidence?.file?.endsWith("mcp-app.ts"),
        ) &&
        Object.hasOwn(node, "source") === false,
    ),
    `details returns source-free direct call references: ${JSON.stringify(details.nodes)}`,
  );
  assert.ok(
    details.nodes.some(
      (node) =>
        node.sourceSpan?.file.endsWith("mcp-app.ts") &&
        typeof node.sourceSpan.startLine === "number",
    ),
    `details returns source line anchors: ${JSON.stringify(details.nodes)}`,
  );
  assert.ok(
    details.nodes.some((node) =>
      node.decorators?.some(
        (decorator) =>
          decorator.name === "McpRoute" &&
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
        thinking: "Inspect mcpAdapter object outline without reading source.",
        request: {
          type: "details",
          handles: ["mcpAdapter"],
        },
      }),
    })) as ToolResult,
  );
  assert.ok(
    objectDetails.nodes.some(
      (node) =>
        node.name === "mcpAdapter" &&
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
        thinking: "Inspect McpService.run shape without reading source.",
        request: {
          type: "details",
          handles: ["McpService.run"],
        },
      }),
    })) as ToolResult,
  );
  assert.ok(
    detailsShape.nodes.some(
      (node) =>
        node.name === "McpService.run" &&
        node.calls?.some(
          (call) =>
            call.name === "mcpHelper" &&
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
        thinking: "Map immediate McpService.run dependencies as graph ranges.",
        request: {
          type: "details",
          handles: ["McpService.run"],
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
            ref.name === "mcpHelper" &&
            ref.evidence?.file?.endsWith("mcp-app.ts") &&
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
          handles: ["McpRunner.run"],
        },
      }),
    })) as ToolResult,
  );
  assert.ok(
    interfaceDetails.nodes.some(
      (node) =>
        node.name === "McpRunner.run" &&
        node.implementedBy?.some(
          (ref) =>
            ref.name === "McpService.run" &&
            ref.relation === "implements" &&
            ref.file.endsWith("mcp-app.ts"),
        ),
    ),
    `details returns implementation candidates: ${JSON.stringify(interfaceDetails.nodes)}`,
  );
}
