import { TestProject } from "@ttsc/testing";

import { TtsgraphClient, assert } from "../internal/ttsgraph";

interface ToolResult {
  structuredContent?: {
    next?: { action?: string; request?: string; reason?: string };
    result?: TraceResult;
  };
}

interface TraceResult {
  type: "trace";
  hops: { from: string; to: string; kind: string }[];
  path?: { id: string; name: string }[];
  junctions?: unknown[];
}

/** One hop past the largest `maxDepth` path mode accepts. */
const OVER_CEILING_HOPS = 13;

/**
 * Verifies path mode reports a depth-bounded miss as a bound with a usable
 * continuation, and keeps the no-connection verdict for a search that actually
 * exhausted the eligible graph.
 *
 * `findPath` returned one sentinel for two different facts — the search space
 * ran out, or the walk was cut off before it could decide — and the path branch
 * read it as complete knowledge, answering "they touch nothing in common, so
 * the graph holds no connection between them" with `next.action: "outside"`.
 * That is the worst thing an index can say wrongly: the caller stops asking.
 * Worse, path mode caps `maxDepth` at 12, so a 13-hop path was unanswerable at
 * every legal request and still reported as absent, and when the two ends
 * happened to share a symbol the junction branch offered a seam that was not
 * the seam. Eligibility here must mean what it means for the open trace, so a
 * frontier of only filtered externals, file nodes, or already-visited nodes is
 * exhaustion, not a bound.
 *
 * 1. Materialize a chain longer than the ceiling, a pair that shares a state
 *    property and also has a direct path, a genuinely disconnected pair with
 *    and without a shared junction, an external-only frontier, a cycle, a type
 *    chain, and a dispatch seam.
 * 2. Request each path through the real MCP launcher at bounds above, at, and
 *    below the shortest path.
 * 3. Assert a bounded miss never carries the disconnection verdict or a junction
 *    seam, that its continuation changes at the ceiling, and that exhausted
 *    searches, found paths, and the identity path are unchanged.
 */
export const test_ttscgraph_path_reports_its_depth_bound_instead_of_a_disconnection =
  async () => {
    const chain = Array.from(
      { length: OVER_CEILING_HOPS + 1 },
      (_unused, index) =>
        index === OVER_CEILING_HOPS
          ? `export function n${index}(): void {}`
          : `export function n${index}(): void { n${index + 1}(); }`,
    ).join("\n");

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
      "node_modules/path-dependency/package.json": JSON.stringify({
        name: "path-dependency",
        version: "1.0.0",
        types: "index.d.ts",
      }),
      "node_modules/path-dependency/index.d.ts":
        "export declare function externalWork(): void;\n",
      "src/chain.ts": `${chain}\n`,
      "src/app.ts": [
        'import { externalWork } from "path-dependency";',
        "",
        "export class Store {",
        "  public value = 0;",
        "}",
        "",
        "export const store = new Store();",
        "",
        "export function seamStart(): void {",
        "  if (store.value === 0) seamMiddleOne();",
        "}",
        "",
        "function seamMiddleOne(): void {",
        "  seamMiddleTwo();",
        "}",
        "",
        "function seamMiddleTwo(): void {",
        "  seamEnd();",
        "}",
        "",
        "export function seamEnd(): number {",
        "  return store.value;",
        "}",
        "",
        "export function holderA(): number {",
        "  return store.value;",
        "}",
        "",
        "export function holderB(): number {",
        "  return store.value + 1;",
        "}",
        "",
        "export function apartLeft(): void {}",
        "export function apartRight(): void {}",
        "",
        "export function edgeStart(): void {",
        "  edgeMid();",
        "}",
        "",
        "function edgeMid(): void {",
        "  externalWork();",
        "}",
        "",
        "export function ringA(): void {",
        "  ringB();",
        "}",
        "",
        "function ringB(): void {",
        "  ringA();",
        "}",
        "",
        "export interface TypeBase {",
        "  value: number;",
        "}",
        "",
        "export interface TypeMiddle extends TypeBase {",
        "  extra: number;",
        "}",
        "",
        "export interface TypeLeaf extends TypeMiddle {",
        "  more: number;",
        "}",
        "",
        "export interface Emitter {",
        "  fire(): void;",
        "}",
        "",
        "export class Silent implements Emitter {",
        "  public fire(): void {}",
        "}",
        "",
        "export function useEmitter(emitter: Emitter): void {",
        "  emitter.fire();",
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
      ): Promise<NonNullable<ToolResult["structuredContent"]>> => {
        const response = (await client.request("tools/call", {
          name: "inspect_typescript_graph",
          arguments: {
            question: "How does one end reach the other?",
            draft: {
              reason: "Path mode is the one-call answer for two known ends.",
              type: "trace",
            },
            review: "Confirmed: answer from the path the graph holds.",
            request: { type: "trace", ...request },
          },
        })) as ToolResult;
        assert.equal(
          response.structuredContent?.result?.type,
          "trace",
          `expected a trace result: ${JSON.stringify(response)}`,
        );
        return response.structuredContent!;
      };

      const exhausted = await call({
        from: "apartLeft",
        to: "apartRight",
        focus: "execution",
      });
      assert.equal(
        exhausted.next?.action,
        "outside",
        "an exhausted search with nothing in common keeps its verdict",
      );

      const junctioned = await call({
        from: "holderA",
        to: "holderB",
        focus: "all",
      });
      assert.equal(
        junctioned.next?.action,
        "inspect",
        "an exhausted search over a shared symbol keeps its junction verdict",
      );
      assert.ok(
        (junctioned.result!.junctions?.length ?? 0) > 0,
        `and still names the seam: ${JSON.stringify(junctioned.result!.junctions)}`,
      );

      const boundedSeam = await call({
        from: "seamStart",
        to: "seamEnd",
        focus: "all",
        maxDepth: 2,
      });
      assert.notEqual(
        boundedSeam.next?.action,
        "outside",
        "a walk stopped by the bound is not evidence the graph holds no connection",
      );
      assert.equal(boundedSeam.next?.action, "inspect");
      assert.equal(
        boundedSeam.next?.request,
        "trace",
        "and the continuation is another graph call, not an escape",
      );
      assert.notEqual(
        boundedSeam.next?.reason,
        exhausted.next?.reason,
        "the bound must not be narrated as a proven disconnection",
      );
      assert.notEqual(
        boundedSeam.next?.reason,
        junctioned.next?.reason,
        "nor as a callback seam, when a direct path runs past the bound",
      );
      assert.equal(
        boundedSeam.result!.junctions,
        undefined,
        "a junction explains an absence, and no absence was established",
      );

      const foundSeam = await call({
        from: "seamStart",
        to: "seamEnd",
        focus: "all",
        maxDepth: 3,
      });
      assert.equal(
        foundSeam.next?.action,
        "answer",
        "the same query at the path's own length is unchanged",
      );
      assert.equal(
        foundSeam.result!.hops.length,
        3,
        "and returns the whole path",
      );

      const overCeiling = await call({
        from: "n0",
        to: `n${OVER_CEILING_HOPS}`,
        focus: "execution",
        maxDepth: 12,
      });
      assert.notEqual(
        overCeiling.next?.action,
        "outside",
        "a path longer than the hard ceiling is not reported as absent",
      );
      assert.notEqual(
        overCeiling.next?.reason,
        boundedSeam.next?.reason,
        "at the ceiling the continuation cannot be 'raise maxDepth'",
      );

      const underCeiling = await call({
        from: "n0",
        to: `n${OVER_CEILING_HOPS - 1}`,
        focus: "execution",
        maxDepth: 12,
      });
      assert.equal(
        underCeiling.next?.action,
        "answer",
        "the longest answerable path is still answered",
      );
      assert.equal(underCeiling.result!.hops.length, OVER_CEILING_HOPS - 1);

      const identity = await call({ from: "apartLeft", to: "apartLeft" });
      assert.deepEqual(
        identity.result!.path?.map((node) => node.name),
        ["apartLeft"],
        "the identity path is unchanged",
      );
      assert.equal(identity.next?.action, "answer");

      const oneHop = await call({
        from: "n0",
        to: "n1",
        focus: "execution",
        maxDepth: 1,
      });
      assert.equal(
        oneHop.next?.action,
        "answer",
        "a path exactly as long as the smallest bound is found",
      );

      const externalFrontier = await call({
        from: "edgeStart",
        to: "apartRight",
        focus: "execution",
        maxDepth: 1,
        includeExternal: false,
      });
      assert.equal(
        externalFrontier.next?.action,
        "outside",
        "a frontier of only excluded externals is exhaustion, not a bound",
      );
      const externalEligible = await call({
        from: "edgeStart",
        to: "apartRight",
        focus: "execution",
        maxDepth: 1,
        includeExternal: true,
      });
      assert.equal(
        externalEligible.next?.action,
        "inspect",
        "the same frontier is a bound once those externals are eligible",
      );

      const cyclic = await call({
        from: "ringA",
        to: "apartRight",
        focus: "execution",
        maxDepth: 1,
      });
      assert.equal(
        cyclic.next?.action,
        "outside",
        "a frontier of only already-visited nodes is exhaustion, not a bound",
      );

      const boundedTypes = await call({
        from: "TypeLeaf",
        to: "TypeBase",
        focus: "types",
        maxDepth: 1,
      });
      assert.equal(
        boundedTypes.next?.action,
        "inspect",
        "the type focus is bounded by the same rule",
      );
      const foundTypes = await call({
        from: "TypeLeaf",
        to: "TypeBase",
        focus: "types",
        maxDepth: 2,
      });
      assert.equal(foundTypes.next?.action, "answer");

      const boundedDispatch = await call({
        from: "useEmitter",
        to: "Silent.fire",
        focus: "execution",
        maxDepth: 1,
      });
      assert.equal(
        boundedDispatch.next?.action,
        "inspect",
        "a synthesized dispatch edge beyond the bound is a frontier like any other",
      );
      const foundDispatch = await call({
        from: "useEmitter",
        to: "Silent.fire",
        focus: "execution",
        maxDepth: 2,
      });
      assert.equal(
        foundDispatch.result!.hops.at(-1)?.kind,
        "dispatches",
        `the found path crosses the dispatch: ${JSON.stringify(foundDispatch.result!.hops)}`,
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
