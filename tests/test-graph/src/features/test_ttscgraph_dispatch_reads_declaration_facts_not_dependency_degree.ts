import { TestProject } from "@ttsc/testing";

import { TtsgraphClient, assert } from "../internal/ttsgraph";

interface ToolResult {
  structuredContent?: {
    result?: TraceResult;
  };
}

interface TraceResult {
  type: "trace";
  hops: { from: string; to: string; kind: string }[];
  reached: { id: string; name: string }[];
  path?: { id: string; name: string }[];
}

/**
 * Verifies a dispatch hop is decided by what a declaration is, not by how many
 * modeled symbols its body happens to name.
 *
 * Body detection used to count outgoing `calls`/`accesses`/`instantiates`/
 * `renders` edges, which measures dependency degree instead. That is wrong in
 * both directions: an implementation whose body is empty, returns a literal,
 * throws, or only moves locals around scored zero and was refused as a dispatch
 * target, so the trace dead-ended on the declaration and reported nothing was
 * omitted; and a concrete base method was promoted through its own override the
 * moment its body stopped naming anything the graph models, so two graphs
 * identical in every declaration fact answered differently because of one
 * statement inside a body. The declaration facts the fix reads — kind,
 * `abstract`/`declare` modifiers, and interface or ambient ownership — are only
 * proven end to end through the real producer, which is why this runs the
 * shipped binary rather than a synthetic in-memory graph.
 *
 * 1. Materialize implementations that name nothing (empty, literal, local
 *    arithmetic, thrown literal) behind an interface member, an abstract
 *    method, and an ambient `declare class` member, plus two concrete bases
 *    with overrides that differ only in one statement, plus an overload set.
 * 2. Trace forward from each caller through the real MCP launcher, and request the
 *    same continuation in path mode.
 * 3. Assert every genuinely bodyless declaration dispatches to its dependency-
 *    free implementation, that neither concrete base is promoted through its
 *    override, and that `focus: "types"` still synthesizes nothing.
 */
export const test_ttscgraph_dispatch_reads_declaration_facts_not_dependency_degree =
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
          include: ["src"],
        },
        null,
        2,
      ),
      "src/app.ts": [
        "export function accepted(): void {}",
        "export function derivedOnly(): void {}",
        "",
        "export interface Pipeline {",
        "  execute(): void;",
        "}",
        "",
        "export class Empty implements Pipeline {",
        "  public execute(): void {}",
        "}",
        "",
        "export function callPipeline(pipeline: Pipeline): void {",
        "  pipeline.execute();",
        "}",
        "",
        "export interface Reader {",
        "  read(): number;",
        "}",
        "",
        "export class Constant implements Reader {",
        "  public read(): number {",
        "    return 1;",
        "  }",
        "}",
        "",
        "export class Computed implements Reader {",
        "  public read(): number {",
        "    let total = 0;",
        "    for (let i = 0; i < 3; i++) total += i;",
        "    return total;",
        "  }",
        "}",
        "",
        "export class Refusing implements Reader {",
        "  public read(): number {",
        '    throw "unsupported";',
        "  }",
        "}",
        "",
        "export function callReader(reader: Reader): number {",
        "  return reader.read();",
        "}",
        "",
        "export abstract class Task {",
        "  public abstract perform(): void;",
        "",
        "  public start(): void {",
        "    this.perform();",
        "  }",
        "}",
        "",
        "export class QuietTask extends Task {",
        "  public perform(): void {}",
        "}",
        "",
        "declare class Native {",
        "  handle(): void;",
        "}",
        "",
        "export class RealNative extends Native {",
        "  public handle(): void {}",
        "}",
        "",
        "export function callNative(native: Native): void {",
        "  native.handle();",
        "}",
        "",
        "export class Base {",
        "  public run(): void {}",
        "}",
        "",
        "export class Derived extends Base {",
        "  public run(): void {",
        "    derivedOnly();",
        "  }",
        "}",
        "",
        "export function callBase(base: Base): void {",
        "  base.run();",
        "}",
        "",
        "export class Loud {",
        "  public speak(): void {",
        "    accepted();",
        "  }",
        "}",
        "",
        "export class Louder extends Loud {",
        "  public speak(): void {",
        "    derivedOnly();",
        "  }",
        "}",
        "",
        "export function callLoud(loud: Loud): void {",
        "  loud.speak();",
        "}",
        "",
        "export class Formatter {",
        "  public format(value: string): string;",
        "  public format(value: number): string;",
        "  public format(value: string | number): string {",
        "    return String(value);",
        "  }",
        "}",
        "",
        "export function callFormatter(formatter: Formatter): string {",
        "  return formatter.format(1);",
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
            question: "What does this call actually run?",
            draft: {
              reason: "A trace is the smallest step for a runtime flow.",
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

      /** The names a trace reached over a synthesized `dispatches` hop. */
      const dispatchedIn = (trace: TraceResult): string[] =>
        trace.hops
          .filter((hop) => hop.kind === "dispatches")
          .map(
            (hop) =>
              trace.reached.find((node) => node.id === hop.to)?.name ?? hop.to,
          );

      const forward = async (from: string): Promise<TraceResult> =>
        call({ from, direction: "forward", focus: "execution", maxDepth: 4 });

      const emptyBody = await forward("callPipeline");
      assert.ok(
        dispatchedIn(emptyBody).includes("Empty.execute"),
        `an implementation with an empty body is still the code that runs: ${JSON.stringify(emptyBody.hops)}`,
      );

      const dependencyFree = await forward("callReader");
      const readers = dispatchedIn(dependencyFree);
      for (const implementation of [
        "Constant.read",
        "Computed.read",
        "Refusing.read",
      ])
        assert.ok(
          readers.includes(implementation),
          `a body that names nothing modeled is still a body (${implementation}): ${readers.join(", ")}`,
        );

      const abstractTask = await forward("Task.start");
      assert.ok(
        dispatchedIn(abstractTask).includes("QuietTask.perform"),
        `an abstract method dispatches to a dependency-free override: ${JSON.stringify(abstractTask.hops)}`,
      );

      const ambient = await forward("callNative");
      assert.ok(
        dispatchedIn(ambient).includes("RealNative.handle"),
        `an ambient member is bodyless by declaration, not by degree: ${JSON.stringify(ambient.hops)}`,
      );

      const concreteEmptyBase = await forward("callBase");
      assert.deepEqual(
        dispatchedIn(concreteEmptyBase),
        [],
        "a concrete base with a body is the destination, not a hop to its override",
      );
      assert.ok(
        !concreteEmptyBase.reached.some((node) =>
          ["Derived.run", "derivedOnly"].includes(node.name),
        ),
        `the override stays out of the flow: ${concreteEmptyBase.reached.map((n) => n.name).join(", ")}`,
      );

      const concreteCallingBase = await forward("callLoud");
      assert.deepEqual(
        dispatchedIn(concreteCallingBase),
        [],
        "the same shape answers the same way when the base body calls a helper",
      );
      assert.ok(
        concreteCallingBase.reached.some((node) => node.name === "accepted"),
        "the concrete base's own work is still reached",
      );

      const overloads = await forward("callFormatter");
      assert.deepEqual(
        dispatchedIn(overloads),
        [],
        "an overload set resolved to its one implementation dispatches nowhere",
      );
      assert.equal(
        overloads.reached.filter((node) => node.name === "Formatter.format")
          .length,
        1,
        `the implementation is reached exactly once: ${overloads.reached.map((n) => n.name).join(", ")}`,
      );

      const typed = await call({
        from: "callPipeline",
        direction: "forward",
        focus: "types",
        maxDepth: 4,
      });
      assert.deepEqual(
        dispatchedIn(typed),
        [],
        '`focus: "types"` still synthesizes no runtime dispatch',
      );

      const asPath = await call({
        from: "callPipeline",
        to: "Empty.execute",
        focus: "execution",
        maxDepth: 4,
      });
      assert.deepEqual(
        asPath.path?.map((node) => node.name),
        ["callPipeline", "Pipeline.execute", "Empty.execute"],
        `path mode agrees with the open trace: ${JSON.stringify(asPath.path)}`,
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
