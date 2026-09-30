import fs from "node:fs";
import path from "node:path";

import { withIdentityBoundary } from "../internal/identityBoundary";
import { assert } from "../internal/ttsgraph";

interface ToolResult {
  structuredContent?: unknown;
}

interface Member {
  name: string;
  kind: string;
  line?: number;
  signature?: string;
}

const detailsArguments = (handle: string) => ({
  question: `What direct members does ${handle} declare?`,
  graphNeed: "The synchronized graph owns the declaration outline.",
  draft: {
    reason: "One details request is the smallest complete identity lookup.",
    type: "details",
  },
  review:
    "Confirmed: inspect the named object without replacing graph facts with a file read.",
  request: { type: "details", handles: [handle] },
});

const membersOf = (result: ToolResult, name: string): Member[] => {
  const value = (result.structuredContent ?? {}) as {
    result?: {
      type?: string;
      nodes?: { name?: string; members?: Member[] }[];
    };
  };
  assert.equal(value.result?.type, "details", JSON.stringify(value));
  return value.result?.nodes?.find((node) => node.name === name)?.members ?? [];
};

/**
 * Verifies object details use compiler-snapshot member identity rather than a
 * live-disk brace scanner.
 *
 * Braces in block comments and strings previously changed the scanner depth,
 * while shorthand, literal computed keys, spreads, and wrapped literals fell
 * outside its regex grammar. The direct outline is declaration identity: a
 * spread has no direct property name of its own and must not promote names from
 * another object, just as an inherited class member is not directly owned.
 * Explicit siblings around it remain complete and ordered.
 *
 * 1. Synchronize a wrapped object containing comment/string braces, static and
 *    dynamic keys, nested objects, methods/accessors, and a spread.
 * 2. Assert every direct statically named member is returned in AST order while
 *    nested, spread-origin, and dynamic names are not fabricated.
 * 3. Replace the file in the same MCP session and assert a later details call
 *    observes the new compiler snapshot rather than cached stale identity.
 *
 * @evidence contracts/testing.md#behavioral-verification MCP details exposes sixteen direct object members in authored order with kinds, lines and declaration-head signatures, excludes nested/spread/dynamic members and body markers, then reflects a replacement object.
 * @evidence contracts/testing.md#independent-expectations The fixture's static direct keys, expected line coordinates and literal signature fragments supply independent expectations; eight private body markers must never appear in the response.
 * @evidence contracts/testing.md#distinguishing-cases Methods, accessors, shorthand, literal and callable values contrast spread/dynamic/nested keys; editing the same source replaces the outline rather than retaining stale members.
 * @evidence contracts/testing.md#execution-ownership The features export test_ttscgraph_details_object_members_follow_compiler_snapshot starts the installed MCP launcher and reaches the native resident graph through stdio; it remains in the E2E runner/Evidence population, with the per-case assertions above rather than source-unit execution.
 * @evidence contracts/e2e.md#necessary-boundary Compiler object-member metadata, source coordinates and a changed resident generation must reach details over MCP; a hand-built outline cannot detect missing native snapshot fields.
 * @evidence contracts/e2e.md#shared-execution Eighteen identity/display, documentation/citation, DTO/audit and dispatch entries borrow one composite project, initialized MCP session and resident native compiler. Only the object-source mutation requires a new generation. The checker-rejection entry also executes the public dump CLI once because diagnostics/raw edges are a separate entrypoint connection; all named assertions remain.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Unique source files, symbol names and citation targets isolate fixtures; disjoint dispatch contracts and hub populations prevent cross-case implementations. Role-sensitive sources retain their spec/test suffix and real dependency declarations stay external. Only object-outline.ts changes; suite finally closes the shared client and checks successful exit after complete collection.
 * @evidence contracts/e2e.md#preserved-coverage All original ordered names/kinds, signatures, line bounds, private-marker exclusions and replacement assertions survive. No source-text layout check substitutes for returned behavior.
 */
export const test_ttscgraph_details_object_members_follow_compiler_snapshot =
  async () => {
    await withIdentityBoundary(async (client, root) => {
      const original = membersOf(
        (await client.request("tools/call", {
          name: "inspect_typescript_graph",
          arguments: detailsArguments("shape"),
        })) as ToolResult,
        "shape",
      );
      assert.deepEqual(
        original.map((member) => [member.name, member.kind]),
        [
          ["real", "property"],
          ["close", "property"],
          ["text", "property"],
          ["shorthand", "property"],
          ["static-key", "property"],
          ["", "property"],
          ["1", "property"],
          ["method", "method"],
          ["value", "method"],
          ["value", "method"],
          ["run", "property"],
          ["classic", "property"],
          ["klass", "property"],
          ["list", "property"],
          ["nested", "property"],
          ["afterSpread", "property"],
        ],
      );
      assert.ok(
        original.every(
          (member) =>
            member.name !== "inner" &&
            member.name !== "fromSpread" &&
            member.name !== "dynamic",
        ),
        JSON.stringify(original),
      );
      assert.equal(original[0]?.line, 7);
      assert.equal(original[0]?.signature, "real: 1");
      assert.equal(original.at(-1)?.signature, "afterSpread: true");
      const signatures = new Map(
        original.map((member) => [member.name, member.signature]),
      );
      assert.equal(signatures.get("method"), "method() {");
      assert.equal(signatures.get("run"), "run: () =>");
      assert.equal(signatures.get("classic"), "classic: function () {");
      assert.equal(signatures.get("klass"), "klass: class");
      assert.equal(signatures.get("list"), "list: [");
      assert.equal(signatures.get("nested"), "nested: {");
      for (const forbidden of [
        "METHOD_BODY_MUST_NOT_APPEAR",
        "ACCESSOR_BODY_MUST_NOT_APPEAR",
        "SETTER_BODY_MUST_NOT_APPEAR",
        "ARROW_BODY_MUST_NOT_APPEAR",
        "FUNCTION_BODY_MUST_NOT_APPEAR",
        "CLASS_BODY_MUST_NOT_APPEAR",
        "ARRAY_CONTENT_MUST_NOT_APPEAR",
        "NESTED_BODY_MUST_NOT_APPEAR",
      ])
        assert.ok(
          original.every(
            (member) => member.signature?.includes(forbidden) !== true,
          ),
          `${forbidden}: ${JSON.stringify(original)}`,
        );

      fs.writeFileSync(
        path.join(root, "src", "object-outline.ts"),
        "export const shape = { replacement: 2 };\n",
      );
      const refreshed = membersOf(
        (await client.request("tools/call", {
          name: "inspect_typescript_graph",
          arguments: detailsArguments("shape"),
        })) as ToolResult,
        "shape",
      );
      assert.deepEqual(
        refreshed.map((member) => member.name),
        ["replacement"],
      );
      assert.equal(refreshed[0]?.signature, "replacement: 2");
    });
  };
