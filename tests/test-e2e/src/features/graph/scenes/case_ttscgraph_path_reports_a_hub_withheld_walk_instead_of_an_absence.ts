import fs from "node:fs";
import path from "node:path";

import { withIdentityBoundary } from "../../../internal/graph/internal/identityBoundary";
import { assert } from "../../../internal/graph/internal/ttsgraph";

interface ToolResult {
  content: { type: string; text: string }[];
  structuredContent?: unknown;
}

interface PathStructure {
  result?: { type: string; hops: { kind: string; to: string }[] };
  next?: { action: string; request?: string; reason?: string };
}

interface DetailsStructure {
  result?: {
    type: string;
    nodes: { name: string; implementedBy?: { name?: string }[] }[];
  };
}

const graphArguments = (request: Record<string, unknown>) => ({
  question: "How does the runner reach one implementation?",
  draft: {
    reason: "Path mode is the one-call answer for two known ends.",
    type: request.type,
  },
  review:
    "Confirmed: answer from the graph facts; do not replace them with file reads.",
  request,
});

const source = (implementations: number): string =>
  [
    "export abstract class Hub {",
    "  public abstract execute(): void;",
    "}",
    "",
    ...Array.from({ length: implementations }, (_, index) =>
      [
        `export class Impl${index} extends Hub {`,
        "  public execute(): void {}",
        "}",
        "",
      ].join("\n"),
    ),
    "export class Runner {",
    "  public constructor(private readonly hub: Hub) {}",
    "",
    "  public run(): void {",
    "    this.hub.execute();",
    "  }",
    "}",
    "",
  ].join("\n");

/**
 * Verifies a path walk that a dispatch hub stopped says so instead of reporting
 * an absence.
 *
 * A declaration implemented twelve or more times stays a leaf in a trace. A path
 * request whose target is one of those implementations therefore never enters
 * the fanout, and answering "the ends touch nothing in common" would turn that
 * traversal policy into a claim about the codebase. The walk must say it did not
 * follow the fanout and point at `details`, whose `implementedBy` lists the
 * implementations the caller can ask about next. One implementation fewer is
 * followed, so the same request returns the path.
 *
 * 1. Request the path from `Runner.run` to `Impl3.execute` with eleven
 *    implementations and assert the dispatch hop is returned.
 * 2. Request it with twelve and assert no path, a `details` continuation naming
 *    the withheld dispatch fanout, and not the `outside` verdict.
 * 3. Ask `details` for `Hub.execute` at its largest dependency limit and assert it
 *    lists implementations the source declares. That limit is smaller than the
 *    fanout, so only some of the twelve can be named; the scenario records that
 *    and does not claim the list is complete.
 *
 * @evidence contracts/testing.md#behavioral-verification The real MCP launcher and native graph return the path through eleven dispatch implementations, and for twelve return no path with a details continuation about the withheld fanout while details at its largest dependency limit lists declared implementations.
 * @evidence contracts/testing.md#independent-expectations The authored eleven and twelve implementation populations bracket the documented hub cut, and the expected hop kind, continuation action and implementation names come from the authored source, not from the returned selection.
 * @evidence contracts/testing.md#distinguishing-cases Eleven implementations are the followed positive, twelve the withheld boundary, and the outside verdict is the negative the withheld result must not take; the depth-bound scenario owns the maxDepth boundary.
 * @evidence contracts/testing.md#execution-ownership Called by test_e2e_graph, this exported scene starts the installed MCP launcher and reaches the native resident graph through stdio; runTrace's walk is only observable together with the compiler's dispatch facts.
 * @evidence contracts/e2e.md#necessary-boundary Real compiler heritage facts must reach the graph before the path walk can distinguish a withheld fanout from an exhausted graph, and the continuation must name a request that the same session can answer.
 * @evidence contracts/e2e.md#shared-execution Runs inside the experiment's single identity project and MCP session: the scene edits one source file and scopes the include to it, then restores the configuration, so no fresh client or compiler is started.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The include scope and tsconfig bytes are restored by withIdentityBoundary and the scene's own source file is overwritten for each population; the experiment joins the shared MCP process afterwards.
 * @evidence contracts/e2e.md#preserved-coverage Adds the path-mode counterpart of the suppressed-trace scenario; the former open-trace assertions remain in their own scene.
 */
export async function case_ttscgraph_path_reports_a_hub_withheld_walk_instead_of_an_absence(): Promise<void> {
  const call = async (
    implementations: number,
    request: Record<string, unknown>,
  ): Promise<unknown> => {
    let structured: unknown;
    await withIdentityBoundary(async (client, root) => {
      fs.writeFileSync(
        path.join(root, "src", "dispatch-hub.ts"),
        source(implementations),
        "utf8",
      );
      const response = (await client.request("tools/call", {
        name: "inspect_typescript_graph",
        arguments: graphArguments(request),
      })) as ToolResult;
      structured = response.structuredContent;
    }, ["src/dispatch-hub.ts"]);
    return structured;
  };
  const route = {
    type: "trace",
    from: "Runner.run",
    to: "Impl3.execute",
    focus: "execution",
    maxDepth: 6,
  };

  const followed = (await call(11, route)) as PathStructure;
  assert.equal(
    followed.next?.action,
    "answer",
    `below the hub cut the walk enters the fanout and returns the path: ${JSON.stringify(followed)}`,
  );
  assert.ok(
    followed.result?.hops.some((hop) => hop.kind === "dispatches"),
    `the returned path crosses a dispatch hop: ${JSON.stringify(followed.result?.hops)}`,
  );

  const withheld = (await call(12, route)) as PathStructure;
  assert.equal(withheld.result?.hops.length, 0, "no path crosses the withheld fanout");
  assert.notEqual(
    withheld.next?.action,
    "outside",
    "a walk the hub cut stopped is not evidence the graph holds no connection",
  );
  assert.equal(withheld.next?.action, "inspect");
  assert.equal(
    withheld.next?.request,
    "details",
    "the continuation asks for the implementations, which a trace cannot list",
  );
  assert.match(
    withheld.next?.reason ?? "",
    /dispatch fanout of 12 or more implementations/,
    "the reason names the fanout the walk did not follow",
  );

  const details = (await call(12, {
    type: "details",
    handles: ["Hub.execute"],
    dependencyLimit: 4,
  })) as DetailsStructure;
  const listed = (details.result?.nodes[0]?.implementedBy ?? []).map(
    (reference) => reference.name ?? "",
  );
  assert.ok(listed.length >= 2, `details lists implementations: ${JSON.stringify(listed)}`);
  for (const name of listed)
    assert.match(name, /^Impl(?:\d|1[01])\.execute$/, "a listed implementation is one the source declares");
}
