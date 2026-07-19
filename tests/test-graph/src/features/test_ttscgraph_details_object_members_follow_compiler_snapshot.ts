import { TestProject } from "@ttsc/testing";
import fs from "node:fs";
import path from "node:path";

import { TtsgraphClient, assert } from "../internal/ttsgraph";

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
 */
export const test_ttscgraph_details_object_members_follow_compiler_snapshot =
  async () => {
    const before = [
      "const shorthand = 1;",
      'const dynamic = Math.random() > 0.5 ? "a" : "b";',
      "const spread = { fromSpread: true };",
      "",
      "export const shape = (({",
      "  /* { */",
      "  real: 1,",
      '  close: "}",',
      '  text: "{",',
      "  shorthand,",
      '  ["static-key"]: 2,',
      '  [""]: 4,',
      "  [1]: true,",
      "  [dynamic]: 3,",
      '  method() { return "METHOD_BODY_MUST_NOT_APPEAR"; },',
      '  get value() { return "ACCESSOR_BODY_MUST_NOT_APPEAR"; },',
      '  set value(input: number) { void "SETTER_BODY_MUST_NOT_APPEAR"; },',
      '  run: () => "ARROW_BODY_MUST_NOT_APPEAR",',
      '  classic: function () { return "FUNCTION_BODY_MUST_NOT_APPEAR"; },',
      '  klass: class { method() { return "CLASS_BODY_MUST_NOT_APPEAR"; } },',
      '  list: ["ARRAY_CONTENT_MUST_NOT_APPEAR"],',
      '  nested: { inner: "NESTED_BODY_MUST_NOT_APPEAR" },',
      "  ...spread,",
      "  /* } */",
      "  afterSpread: true,",
      "}) as const) satisfies Record<PropertyKey, unknown>;",
      "",
    ].join("\n");
    const root = TestProject.createProject({
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "commonjs",
          strict: true,
        },
        include: ["src"],
      }),
      "src/index.ts": before,
    });

    const client = TtsgraphClient.start(root);
    try {
      await client.request("initialize", {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "test-graph", version: "0.0.0" },
      });
      client.notify("notifications/initialized", {});

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
        path.join(root, "src", "index.ts"),
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
    } finally {
      client.endStdin();
    }

    const code = await client.waitForExit();
    assert.equal(code, 0, client.stderrText());
  };
