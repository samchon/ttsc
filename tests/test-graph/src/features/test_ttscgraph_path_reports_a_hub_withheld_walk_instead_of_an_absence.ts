import assert from "node:assert/strict";

import { TtscGraphApplication } from "../../../../packages/graph/src/TtscGraphApplication";
import { createSyntheticGraph, type ResolverGraphNode } from "../internal/resolverGraph";

const nodes = (implementations: number): ResolverGraphNode[] => [
  { id: "src/hub.ts#Hub:interface", kind: "interface", name: "Hub", file: "src/hub.ts", external: false },
  { id: "src/hub.ts#Hub.execute:method", kind: "method", name: "execute", qualifiedName: "Hub.execute", file: "src/hub.ts", external: false },
  { id: "src/hub.ts#Runner.run:method", kind: "method", name: "run", qualifiedName: "Runner.run", file: "src/hub.ts", external: false },
  ...Array.from({ length: implementations }, (_, index) => ({
    id: `src/hub.ts#Impl${index}.execute:method`,
    kind: "method",
    name: "execute",
    qualifiedName: `Impl${index}.execute`,
    file: "src/hub.ts",
    external: false,
  })),
];

// The producer records an implementation's member as overriding the base member,
// and the bodyless base is what makes the walk dispatch into its implementations.
const edges = (implementations: number) => [
  { from: "src/hub.ts#Hub:interface", to: "src/hub.ts#Hub.execute:method", kind: "contains" },
  { from: "src/hub.ts#Runner.run:method", to: "src/hub.ts#Hub.execute:method", kind: "calls" },
  ...Array.from({ length: implementations }, (_, index) => ({
    from: `src/hub.ts#Impl${index}.execute:method`,
    to: "src/hub.ts#Hub.execute:method",
    kind: "overrides",
  })),
];

/**
 * Verifies a path walk that a dispatch hub stopped reports its boundary instead
 * of an absence.
 *
 * A declaration implemented twelve or more times is a leaf in a trace, so a path
 * request that must cross that fanout never enters it. The application must not
 * then say the ends touch nothing in common; it must say the walk did not follow
 * the fanout and ask for `details`, which lists the implementations. One fewer
 * implementation is followed, and the same request returns the path.
 *
 * 1. Request the path from `Runner.run` to `Impl3.execute` with eleven
 *    implementations and assert the dispatch hop is returned.
 * 2. Request it with twelve and assert no path, an `inspect` continuation that
 *    asks for `details` and names the withheld fanout.
 * 3. Assert `details` for the hub, at its largest dependency limit, lists
 *    implementations the source declares. The limit is smaller than the fanout,
 *    so the continuation can name only some of the twelve; the scenario records
 *    that and does not claim the list is complete.
 *
 * @evidence contracts/testing.md#behavioral-verification TtscGraphApplication.inspect_typescript_graph runs the real path walk over a synthetic graph: eleven dispatch implementations return the path through a dispatches hop, twelve return no path with a details continuation naming the withheld fanout, and details at its largest dependency limit lists declared implementations.
 * @evidence contracts/testing.md#independent-expectations The authored populations eleven and twelve bracket the documented hub cut, and the expected action, request and implementation names follow from the authored edges and the withheld-walk contract, not from the returned selection.
 * @evidence contracts/testing.md#distinguishing-cases Eleven implementations are the followed positive, twelve the withheld boundary, and the outside verdict is the negative the withheld result must not take; depth-bound disconnection is owned by a sibling E2E scenario.
 * @evidence contracts/testing.md#execution-ownership The src/features export is selected by the source-unit runner and calls the authored application, path walk and memory code in its Node process; no installed package, native producer or MCP host is started. The matching real-compiler heritage facts are owned by the E2E graph scenario for the same behavior.
 */
export async function test_ttscgraph_path_reports_a_hub_withheld_walk_instead_of_an_absence(): Promise<void> {
  const ask = async (implementations: number, request: Record<string, unknown>) => {
    const application = new TtscGraphApplication(
      createSyntheticGraph(nodes(implementations), edges(implementations)),
    );
    return application.inspect_typescript_graph({
      question: "How does the runner reach one implementation?",
      draft: { reason: "Path mode answers two known ends.", type: request.type as "trace" },
      review: "Keep the explicit request.",
      request: request as never,
    });
  };
  const route = { type: "trace", from: "Runner.run", to: "Impl3.execute", focus: "execution", maxDepth: 6 };

  const followed = await ask(11, route);
  assert.equal(followed.next?.action, "answer", JSON.stringify(followed.next));
  assert.equal(followed.result.type, "trace");
  if (followed.result.type !== "trace") assert.fail("trace result required");
  assert.ok(followed.result.hops.some((hop) => hop.kind === "dispatches"));

  const withheld = await ask(12, route);
  assert.equal(withheld.result.type, "trace");
  if (withheld.result.type !== "trace") assert.fail("trace result required");
  assert.equal(
    withheld.result.hops.some((hop) => hop.to.includes("Impl3")),
    false,
    "no returned hop crosses the withheld fanout: " + JSON.stringify(withheld),
  );
  assert.notEqual(withheld.next?.action, "outside", "the hub cut is a boundary, not a disconnection");
  assert.equal(withheld.next?.action, "inspect");
  assert.equal(withheld.next?.request, "details");
  assert.match(withheld.next?.reason ?? "", /dispatch fanout of 12 or more implementations/);

  const details = await ask(12, { type: "details", handles: ["Hub.execute"], dependencyLimit: 4 });
  assert.equal(details.result.type, "details");
  if (details.result.type !== "details") assert.fail("details result required");
  const listed = (details.result.nodes[0]?.implementedBy ?? []).map((reference) => reference.name);
  assert.ok(listed.length >= 2, `the continuation lists implementations: ${JSON.stringify(listed)}`);
  for (const name of listed)
    assert.match(name, /^Impl(?:\d|1[01])\.execute$/, "a listed implementation is one the source declares");
}
