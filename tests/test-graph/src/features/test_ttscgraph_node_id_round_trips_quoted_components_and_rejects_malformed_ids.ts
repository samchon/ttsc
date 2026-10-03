import assert from "node:assert/strict";

import {
  parseTtscGraphNodeId,
  writeTtscGraphNodeId,
} from "../../../../packages/graph/src/model/TtscGraphNodeId";

/**
 * Verifies the graph node-id codec reads and writes the `path#name:kind`
 * identity, quoting `#` and `\`, and refuses ids that name no symbol.
 *
 * The producer quotes the two characters that could move a component boundary,
 * so an id with a quoted hash must keep it inside its component, and a hash
 * preceded by an even number of backslashes is a real separator. An id with no
 * separator or with an empty name or kind names nothing and must not reach
 * symbol lookup.
 *
 * 1. Parse ids with a kind, without a kind, with quoted hashes in the path and in
 *    the name, with a colon in the name and with a quoted backslash before the
 *    separator, comparing each with its literal components.
 * 2. Parse ids with no separator, an empty tail, an empty name, an empty kind and
 *    only a quoted hash, and require undefined for each.
 * 3. Write an identity whose path and name hold `\` and `#` and require the
 *    quoted literal, then parse it back to the original components.
 *
 * @evidence contracts/testing.md#behavioral-verification parseTtscGraphNodeId must return the literal path, name and optional kind for each well-formed id and undefined for each malformed one, and writeTtscGraphNodeId must produce the quoted literal that parses back to the same components.
 * @evidence contracts/testing.md#independent-expectations Each id and component is a literal derived from the documented path#name:kind grammar (a backslash quotes a hash or a backslash, the final colon opens the kind), not read from the codec; the written form is the literal quoting of the authored input.
 * @evidence contracts/testing.md#distinguishing-cases A kindless legacy id contrasts a kinded one, a quoted hash contrasts the separator hash, an even backslash run contrasts an odd one, and each malformed shape (no hash, empty tail, empty name, empty kind, only quoted hash) is a negative; the legacy UNC path form and kinds that are not declaration kinds are not exercised.
 * @evidence contracts/testing.md#execution-ownership The src/features export calls the id codec directly in the unit process; no producer, session or installed package is involved.
 */
export function test_ttscgraph_node_id_round_trips_quoted_components_and_rejects_malformed_ids(): void {
  const failures: unknown[] = [];
  const check = (assertion: () => void): void => {
    try {
      assertion();
    } catch (error) {
      failures.push(error);
    }
  };

  const parsed: [string, { path: string; name: string; kind?: string }][] = [
    ["src/box.ts#Box.a:class", { path: "src/box.ts", name: "Box.a", kind: "class" }],
    ["src/box.ts#Box", { path: "src/box.ts", name: "Box" }],
    ["src/a\\#b.ts#n:function", { path: "src/a#b.ts", name: "n", kind: "function" }],
    ["src/a.ts#a\\#b:variable", { path: "src/a.ts", name: "a#b", kind: "variable" }],
    ["src/a.ts#a:b:c", { path: "src/a.ts", name: "a:b", kind: "c" }],
    ["src/a\\\\#n:class", { path: "src/a\\", name: "n", kind: "class" }],
  ];
  for (const [id, expected] of parsed)
    check(() => assert.deepStrictEqual(parseTtscGraphNodeId(id), expected, id));

  for (const id of [
    "src/example.ts",
    "src/example.ts#",
    "src/example.ts#:variable",
    "src/example.ts#name:",
    "src/a\\#b.ts:class",
  ])
    check(() => assert.strictEqual(parseTtscGraphNodeId(id), undefined, id));

  check(() => {
    const written = writeTtscGraphNodeId("a\\b#c", "d#e", "k");
    assert.strictEqual(written, "a\\\\b\\#c#d\\#e:k");
    assert.deepStrictEqual(parseTtscGraphNodeId(written), {
      path: "a\\b#c",
      name: "d#e",
      kind: "k",
    });
  });

  if (failures.length) throw new AggregateError(failures, "node id codec");
}
