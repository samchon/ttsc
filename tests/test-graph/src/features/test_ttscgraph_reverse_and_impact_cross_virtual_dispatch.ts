import { TestProject } from "@ttsc/testing";

import { TtsgraphClient, assert } from "../internal/ttsgraph";

interface ToolResult {
  structuredContent?: {
    result?: TraceResult;
  };
}

interface TraceResult {
  type: "trace";
  hops: { from: string; to: string; kind: string; depth: number }[];
  reached: { id: string; name: string; roles?: string[] }[];
  truncated: boolean;
}

/** The twelve-implementation cut `dispatchEdges` treats as a hub, not a flow. */
const HUB_IMPLEMENTATIONS = 12;

/**
 * Verifies a reverse or impact trace crosses virtual dispatch the same way a
 * forward trace does, under the forward direction's own eligibility and hub
 * policy.
 *
 * Dispatch was synthesized on the forward side only, so an impact query on a
 * concrete implementation reached neither the declaration it implements nor any
 * caller resolved to that declaration, and reported `truncated: false` while
 * doing it. That is the query an agent runs before changing a method, and the
 * omission compounds: the base's callers, their callers, the exported surface,
 * and the tests that exercise them all go missing at once. The checker relation
 * is oriented implementation-to-base, so both halves of the path sit one step
 * away in a direction reverse traversal does not take.
 *
 * 1. Materialize an interface with a checker-valid and a checker-rejected
 *    implementation, an abstract base whose override closes a cycle, an
 *    unrelated method, an external heritage leaf, and a twelve-implementation
 *    hub.
 * 2. Issue reverse and impact traces from the implementations through the real MCP
 *    launcher, plus the forward and `focus: "types"` controls.
 * 3. Assert the valid seam is crossed in reverse with roles tagged, that the
 *    rejected pair, the external endpoint, and the hub stay governed by the
 *    forward policy, and that bounds and cycles behave as before.
 */
export const test_ttscgraph_reverse_and_impact_cross_virtual_dispatch =
  async () => {
    const hubImplementations = Array.from(
      { length: HUB_IMPLEMENTATIONS },
      (_unused, index) =>
        [
          `export class Widget${index} implements Widget {`,
          "  public draw(): void {}",
          "}",
          "",
        ].join("\n"),
    ).join("");

    const root = TestProject.createProject({
      "tsconfig.json": JSON.stringify(
        {
          compilerOptions: {
            target: "ES2022",
            module: "commonjs",
            moduleResolution: "node",
            strict: true,
            rootDir: "src",
            outDir: "dist",
          },
          include: ["src"],
        },
        null,
        2,
      ),
      "node_modules/graph-dependency/package.json": JSON.stringify({
        name: "graph-dependency",
        version: "1.0.0",
        types: "index.d.ts",
      }),
      "node_modules/graph-dependency/index.d.ts":
        "export interface Contract {\n  settle(): void;\n}\n",
      "src/app.ts": [
        'import { Contract } from "graph-dependency";',
        "",
        "export function accepted(): void {}",
        "export function rejected(): void {}",
        "",
        "export interface Pipeline {",
        "  execute(input: number): void;",
        "}",
        "",
        "export class Good implements Pipeline {",
        "  public execute(input: number): void {",
        "    accepted();",
        "  }",
        "}",
        "",
        "export class Bad implements Pipeline {",
        "  public execute(input: string): void {",
        "    rejected();",
        "  }",
        "}",
        "",
        "export class Runner {",
        "  public constructor(private readonly pipeline: Pipeline) {}",
        "",
        "  public run(): void {",
        "    this.pipeline.execute(1);",
        "  }",
        "}",
        "",
        "export function main(runner: Runner): void {",
        "  runner.run();",
        "}",
        "",
        "export abstract class Task {",
        "  public abstract perform(): void;",
        "}",
        "",
        "export class RealTask extends Task {",
        "  public perform(): void {",
        "    startTask(this);",
        "  }",
        "}",
        "",
        "export function startTask(task: Task): void {",
        "  task.perform();",
        "}",
        "",
        "export class Alone {",
        "  public solo(): void {}",
        "}",
        "",
        "export function callSolo(alone: Alone): void {",
        "  alone.solo();",
        "}",
        "",
        "export class Settlement implements Contract {",
        "  public settle(): void {}",
        "}",
        "",
        "export interface Widget {",
        "  draw(): void;",
        "}",
        "",
        hubImplementations,
        "export function paint(widget: Widget): void {",
        "  widget.draw();",
        "}",
        "",
      ].join("\n"),
      "src/app.test.ts": [
        'import { main, Runner } from "./app";',
        "",
        "export function exercisesMain(runner: Runner): void {",
        "  main(runner);",
        "}",
        "",
      ].join("\n"),
    });

    const client = TtsgraphClient.start(root);
    try {
      await client.request("initialize", {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "test-graph", version: "0.0.0" },
      });
      client.notify("notifications/initialized", {});

      const call = async (
        request: Record<string, unknown>,
      ): Promise<TraceResult> => {
        const response = (await client.request("tools/call", {
          name: "inspect_typescript_graph",
          arguments: {
            question: "What does changing this implementation reach?",
            draft: {
              reason: "A trace is the smallest step for a blast radius.",
              type: "trace",
            },
            review: "Confirmed: answer from the trace's graph facts.",
            request: { type: "trace", ...request },
          },
        })) as ToolResult;
        const trace = response.structuredContent?.result;
        assert.equal(
          trace?.type,
          "trace",
          `expected a trace result: ${JSON.stringify(response)}`,
        );
        return trace!;
      };

      const names = (trace: TraceResult): string[] =>
        trace.reached.map((node) => node.name);
      const dispatchHops = (trace: TraceResult): number =>
        trace.hops.filter((hop) => hop.kind === "dispatches").length;

      for (const direction of ["reverse", "impact"]) {
        for (const focus of ["execution", "all"]) {
          const crossed = await call({
            from: "Good.execute",
            direction,
            focus,
            maxDepth: 4,
            maxNodes: 12,
          });
          const reached = names(crossed);
          for (const expected of ["Pipeline.execute", "Runner.run", "main"])
            assert.ok(
              reached.includes(expected),
              `${direction}/${focus} crosses the seam to ${expected}: ${reached.join(", ")}`,
            );
          assert.ok(
            dispatchHops(crossed) > 0,
            `${direction}/${focus} records the crossing as a dispatches hop: ${JSON.stringify(crossed.hops)}`,
          );
        }
      }

      const impact = await call({
        from: "Good.execute",
        direction: "impact",
        focus: "execution",
        maxDepth: 4,
        maxNodes: 16,
      });
      assert.ok(
        impact.reached
          .find((node) => node.name === "main")
          ?.roles?.includes("exported"),
        `impact tags the public surface it now reaches: ${JSON.stringify(impact.reached)}`,
      );
      assert.ok(
        impact.reached.some((node) => node.roles?.includes("test")),
        `impact tags the test that exercises the newly reached callers: ${JSON.stringify(impact.reached)}`,
      );

      const abstractOverride = await call({
        from: "RealTask.perform",
        direction: "reverse",
        focus: "execution",
        maxDepth: 4,
        maxNodes: 12,
      });
      const overrideReached = names(abstractOverride);
      for (const expected of ["Task.perform", "startTask"])
        assert.ok(
          overrideReached.includes(expected),
          `an abstract-method override crosses back to ${expected}: ${overrideReached.join(", ")}`,
        );
      const signatures = abstractOverride.hops.map(
        (hop) => `${hop.from}|${hop.to}|${hop.kind}`,
      );
      assert.equal(
        signatures.length,
        new Set(signatures).size,
        `a cycle through an implementation and its base records no duplicate hop: ${signatures.join(", ")}`,
      );

      const invalid = await call({
        from: "Bad.execute",
        direction: "reverse",
        focus: "execution",
        maxDepth: 4,
        maxNodes: 12,
      });
      assert.ok(
        !names(invalid).includes("Pipeline.execute"),
        `a checker-rejected member stays disconnected in reverse: ${names(invalid).join(", ")}`,
      );

      const unrelated = await call({
        from: "Alone.solo",
        direction: "reverse",
        focus: "execution",
        maxDepth: 4,
        maxNodes: 12,
      });
      assert.deepEqual(
        names(unrelated),
        ["callSolo"],
        "a method with no member relation reverses exactly as before",
      );

      const externalFiltered = await call({
        from: "Settlement",
        direction: "reverse",
        focus: "all",
        includeExternal: false,
        maxDepth: 2,
        maxNodes: 12,
      });
      assert.ok(
        !names(externalFiltered).includes("Contract"),
        `an external declaration stays filtered in reverse: ${names(externalFiltered).join(", ")}`,
      );
      const externalIncluded = await call({
        from: "Settlement",
        direction: "reverse",
        focus: "all",
        includeExternal: true,
        maxDepth: 2,
        maxNodes: 12,
      });
      assert.ok(
        names(externalIncluded).includes("Contract"),
        `the same endpoint is reached when externals are eligible: ${names(externalIncluded).join(", ")}`,
      );

      const hubForward = await call({
        from: "paint",
        direction: "forward",
        focus: "execution",
        maxDepth: 3,
        maxNodes: 16,
      });
      assert.equal(
        dispatchHops(hubForward),
        0,
        `a hub declaration stays a leaf going forward: ${JSON.stringify(hubForward.hops)}`,
      );
      const hubReverse = await call({
        from: "Widget0.draw",
        direction: "reverse",
        focus: "execution",
        maxDepth: 3,
        maxNodes: 16,
      });
      assert.equal(
        dispatchHops(hubReverse),
        0,
        `reverse applies the same hub policy: ${JSON.stringify(hubReverse.hops)}`,
      );

      const bounded = await call({
        from: "Good.execute",
        direction: "reverse",
        focus: "execution",
        maxDepth: 1,
        maxNodes: 12,
      });
      assert.deepEqual(
        names(bounded),
        ["Pipeline.execute"],
        "the depth bound governs the synthesized edge like any other",
      );
      assert.equal(
        bounded.truncated,
        true,
        "and the omission beyond that bound is reported",
      );

      const typed = await call({
        from: "Good.execute",
        direction: "reverse",
        focus: "types",
        maxDepth: 4,
        maxNodes: 12,
      });
      assert.equal(
        dispatchHops(typed),
        0,
        `\`focus: "types"\` reverse is unchanged: ${JSON.stringify(typed.hops)}`,
      );

      const forward = await call({
        from: "Runner.run",
        direction: "forward",
        focus: "execution",
        maxDepth: 4,
        maxNodes: 12,
      });
      assert.ok(
        names(forward).includes("Good.execute") &&
          names(forward).includes("accepted"),
        `the forward direction is unchanged: ${names(forward).join(", ")}`,
      );
    } finally {
      client.endStdin();
    }

    const code = await client.waitForExit();
    assert.equal(
      code,
      0,
      `the launcher exits cleanly\nstderr: ${client.stderrText()}`,
    );
  };
