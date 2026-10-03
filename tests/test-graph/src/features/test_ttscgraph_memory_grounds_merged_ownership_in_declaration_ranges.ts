import assert from "node:assert/strict";

import { hasDeclarationBody } from "../../../../packages/graph/src/server/runTrace";
import { createSyntheticGraph, type ResolverGraphNode } from "../internal/resolverGraph";

/**
 * Verifies merged declaration ownership and abstract-class member bodies.
 *
 * A shared qualified name cannot choose between class and interface owners on
 * its own; declaration ranges decide. An abstract class also does not make its
 * concrete methods bodyless.
 *
 * 1. Synthesize members of a merged class and interface in both declaration
 *    orders and with both declarations on one line.
 * 2. Contrast abstract and declare class containers, a unique owner whose member
 *    lies outside its range, and an ambiguous owner whose nodes have no ranges.
 * 3. Collect every contains-edge owner and hasDeclarationBody assertion and fail
 *    with all mismatches.
 *
 * @evidence contracts/testing.md#behavioral-verification TtscGraphMemory.from over synthetic nodes must give each member the contains owner expected from the enclosing declaration range (a class method under the class and an interface member under the interface, in either declaration order and on a single line), and hasDeclarationBody must be true for concrete members and false for interface members, abstract methods and members of a declare class; with no ranges and two candidate owners the member must be contained by the file.
 * @evidence contracts/testing.md#independent-expectations The declaration ranges, modifiers, expected owner ids and expected body flags are literals authored in each case, not read from the synthesized contains edges.
 * @evidence contracts/testing.md#distinguishing-cases Both declaration orders, same-line disjoint ranges, abstract versus declare containers (the concrete member's body flag differs), a unique owner handle whose member lies outside the owner's range (still owned), and an ambiguous handle without ranges (file-owned) each change the expected owner or body decision.
 * @evidence contracts/testing.md#execution-ownership Calls TtscGraphMemory.from through createSyntheticGraph and the exported hasDeclarationBody of runTrace in the test process with typed in-memory nodes; no native producer, generated validator or installed package is involved.
 */
export function test_ttscgraph_memory_grounds_merged_ownership_in_declaration_ranges(): void {
  const failures: unknown[] = [];
  const check = (label: string, nodes: ResolverGraphNode[], expectations: [string, string, boolean][]): void => {
    const graph = createSyntheticGraph(nodes);
    for (const [id, owner, body] of expectations) {
      try { assert.equal(graph.incoming(id).find((edge) => edge.kind === "contains")?.from, owner, `${label}: ${id} owner`); } catch (error) { failures.push(error); }
      try { assert.equal(hasDeclarationBody(graph, graph.node(id)!), body, `${label}: ${id} body`); } catch (error) { failures.push(error); }
    }
  };
  const node = (name: string, kind: ResolverGraphNode["kind"], startLine: number, startCol: number, endLine: number, endCol: number, modifiers?: ResolverGraphNode["modifiers"]): ResolverGraphNode => ({
    id: `src/test.ts#${name}:${kind}`, name: name.split(".").at(-1)!, qualifiedName: name,
    kind, file: "src/test.ts", external: false, evidence: { startLine, startCol, endLine, endCol }, ...(modifiers ? { modifiers } : {}),
  });
  for (const reverse of [false, true]) {
    const classLine = reverse ? 2 : 1, interfaceLine = reverse ? 1 : 2;
    const declarations = [node("C", "class", classLine, 1, classLine, 32), node("C", "interface", interfaceLine, 1, interfaceLine, 38)];
    if (reverse) declarations.reverse();
    check(`merged ${reverse}`, [...declarations, node("C.m", "method", classLine, 18, classLine, 30), node("C.extra", "method", interfaceLine, 22, interfaceLine, 36)], [
      ["src/test.ts#C.m:method", "src/test.ts#C:class", true], ["src/test.ts#C.extra:method", "src/test.ts#C:interface", false],
    ]);
  }
  check("same line", [node("C", "class", 1, 1, 1, 32), node("C", "interface", 1, 34, 1, 71), node("C.m", "method", 1, 18, 1, 30), node("C.extra", "method", 1, 55, 1, 69)], [
    ["src/test.ts#C.m:method", "src/test.ts#C:class", true], ["src/test.ts#C.extra:method", "src/test.ts#C:interface", false],
  ]);
  for (const modifier of ["abstract", "declare"] as const) check(modifier, [node("C", "class", 1, 1, 3, 1, [modifier]), node("C.m", "method", 2, 1, 2, 20, ["abstract"]), node("C.n", "method", 2, 22, 2, 35)], [
    ["src/test.ts#C.m:method", "src/test.ts#C:class", false], ["src/test.ts#C.n:method", "src/test.ts#C:class", modifier === "abstract"],
  ]);
  check("unique merged namespace", [node("C", "class", 1, 1, 1, 32), node("C.extra", "function", 2, 22, 2, 54)], [["src/test.ts#C.extra:function", "src/test.ts#C:class", true]]);
  const missing = [node("C", "class", 1, 1, 1, 32), node("C", "interface", 2, 1, 2, 38), node("C.m", "method", 1, 18, 1, 30)].map(({ evidence: _evidence, ...rest }) => rest);
  check("ambiguous without declaration ranges", missing, [["src/test.ts#C.m:method", "src/test.ts", true]]);
  if (failures.length) throw new AggregateError(failures, "merged ownership/body matrix");
}
