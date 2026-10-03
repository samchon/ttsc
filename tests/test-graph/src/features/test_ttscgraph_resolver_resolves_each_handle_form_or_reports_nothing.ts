import assert from "node:assert/strict";

import {
  type ResolverGraphNode,
  resolveSyntheticGraph,
} from "../internal/resolverGraph";

/**
 * Verifies resolver outcomes: each supported handle spelling names the node it
 * means, an ambiguous name stays ambiguous, and an unknown handle reports
 * nothing.
 *
 * A caller writes handles from memory of an earlier result, so the resolver
 * answers an id, a stale id whose file moved, a bare symbol, a dotted suffix, a
 * file-qualified name and a call spelled on a value. A name declared twice must
 * come back as candidates rather than as a guessed node, and a handle the graph
 * cannot place must yield neither.
 *
 * 1. Build one graph with a unique function, a class holding a method, a nested
 *    method and the same class name declared in two files.
 * 2. Resolve each spelling and compare the node id with the literal the authored
 *    graph names.
 * 3. Resolve the ambiguous bare name and require two candidates and no node, then
 *    resolve unknown and malformed handles and require the empty outcome.
 *
 * @evidence contracts/testing.md#behavioral-verification resolveGraphHandle over an authored graph must return the node for a direct id, a stale-file id, a bare symbol, a dotted suffix, a file-qualified name and a value-receiver member call, two candidates and no node for the bare name declared twice, and an outcome with neither node nor candidates for unknown and malformed handles.
 * @evidence contracts/testing.md#independent-expectations Each handle spelling and the expected node id are literals taken from the documented handle forms and the authored node ids; the resolver's own indexes are not consulted to choose an expectation.
 * @evidence contracts/testing.md#distinguishing-cases A name declared in one file contrasts the same name declared in two (node versus candidates), the file-qualified spelling disambiguates the two, a receiver that is not a type still reaches its member, and the empty, dotless-unknown and trailing-dot handles are the negatives; ranking among candidates is owned by the sibling ranking tests.
 * @evidence contracts/testing.md#execution-ownership The src/features export calls the resolver over an in-memory synthetic dump in the unit process; no producer, session or host is started.
 */
export function test_ttscgraph_resolver_resolves_each_handle_form_or_reports_nothing(): void {
  const node = (
    file: string,
    symbol: string,
    kind: ResolverGraphNode["kind"],
    name: string,
  ): ResolverGraphNode => ({
    id: `${file}#${symbol}:${kind}`,
    kind,
    name,
    ...(symbol === name ? {} : { qualifiedName: symbol }),
    file,
    external: false,
  });
  const nodes = [
    node("src/renderer.ts", "render", "function", "render"),
    node("src/zod.ts", "ZodType", "class", "ZodType"),
    node("src/zod.ts", "ZodType.parse", "method", "parse"),
    node("src/nested.ts", "Outer.Inner.run", "method", "run"),
    node("src/a/shared.ts", "Thing", "class", "Thing"),
    node("src/b/other.ts", "Thing", "class", "Thing"),
  ];
  const failures: unknown[] = [];
  const expectNode = (handle: string, id: string): void => {
    try {
      const resolved = resolveSyntheticGraph(nodes, handle);
      assert.strictEqual(resolved.node?.id, id, handle);
      assert.strictEqual(resolved.candidates, undefined, handle);
    } catch (error) {
      failures.push(error);
    }
  };
  expectNode("src/renderer.ts#render:function", "src/renderer.ts#render:function");
  expectNode("src/old.ts#render:function", "src/renderer.ts#render:function");
  expectNode("render", "src/renderer.ts#render:function");
  expectNode("ZodType.parse", "src/zod.ts#ZodType.parse:method");
  expectNode("Inner.run", "src/nested.ts#Outer.Inner.run:method");
  expectNode("shared.Thing", "src/a/shared.ts#Thing:class");
  expectNode("other.Thing", "src/b/other.ts#Thing:class");
  expectNode("schema.parse", "src/zod.ts#ZodType.parse:method");

  try {
    const ambiguous = resolveSyntheticGraph(nodes, "Thing");
    assert.strictEqual(ambiguous.node, undefined);
    assert.deepStrictEqual(
      ambiguous.candidates?.map((candidate) => candidate.id),
      ["src/a/shared.ts#Thing:class", "src/b/other.ts#Thing:class"],
    );
  } catch (error) {
    failures.push(error);
  }
  for (const handle of ["", "missing", "Missing.thing", "render.", "src/old.ts#gone:function"]) {
    try {
      assert.deepStrictEqual(resolveSyntheticGraph(nodes, handle), {}, JSON.stringify(handle));
    } catch (error) {
      failures.push(error);
    }
  }
  if (failures.length) throw new AggregateError(failures, "handle resolution");
}
