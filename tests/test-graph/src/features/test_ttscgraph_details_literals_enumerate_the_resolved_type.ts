import { TestProject } from "@ttsc/testing";

import { TtsgraphClient, assert } from "../internal/ttsgraph";

interface ToolResult {
  content: { type: string; text: string }[];
  structuredContent?: unknown;
}

interface DetailsResult {
  type: "details";
  nodes: {
    name: string;
    kind: string;
    signature?: string;
    literals?: string[];
    literalsTruncated?: boolean;
  }[];
  unknown: string[];
}

const graphArguments = (props: {
  thinking: string;
  request: Record<string, unknown>;
}) => ({
  question: props.thinking,
  draft: {
    reason: "The smallest useful sacred graph step.",
    type: props.request.type,
  },
  review:
    "Confirmed: keep this final request; do not replace graph facts with file reads.",
  request: props.request,
});

const detailsOf = (result: ToolResult): DetailsResult => {
  const value = (result.structuredContent ?? {}) as { result?: DetailsResult };
  if (value.result?.type !== "details")
    throw new Error(`Unexpected graph result: ${JSON.stringify(value)}`);
  return value.result;
};

/**
 * Verifies `details` reports the values a union or enum admits from the
 * checker's resolved type, so the answer does not depend on how the declaration
 * is wrapped.
 *
 * `literals` was scraped out of the `signature` snippet, which stops after four
 * source lines or at the first `{`, and was then cut to six. So a union written
 * one member per line reported the first three of them, an enum written across
 * lines reported none at all, and `type Indirect = Kind | 'f'` reported `'f'`
 * alone while the members reaching it through `Kind` disappeared — all
 * silently, under an audit telling the caller these facts are compiler-resolved
 * (#732). This pins the whole class end to end, through the real binary: the
 * same type must answer the same way whatever its layout, and a type whose
 * members cannot all be named must report none rather than a subset that reads
 * as complete.
 *
 * 1. Materialize a project holding a wrapped union, a flat twin, a multi-line
 *    enum, an aliased union, and a union widened by `string`.
 * 2. Ask the MCP server for `details` on all five.
 * 3. Assert each value set is complete and layout-independent, that indirection
 *    resolves, and that the widened union reports nothing.
 */
export const test_ttscgraph_details_literals_enumerate_the_resolved_type =
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
        "export type Wrapped =",
        "  | 'a'",
        "  | 'b'",
        "  | 'c'",
        "  | 'd'",
        "  | 'e'",
        "  | 'f'",
        "  | 'g';",
        "",
        "export type Flat = 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g';",
        "",
        "export enum Colors {",
        "  Red = 'red',",
        "  Green = 'green',",
        "  Blue = 'blue',",
        "}",
        "",
        "export type Indirect = Wrapped | 'h';",
        "",
        "export type Widened = Wrapped | string;",
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

      const result = (await client.request("tools/call", {
        name: "inspect_typescript_graph",
        arguments: graphArguments({
          thinking: "Which values do these types admit?",
          request: {
            type: "details",
            handles: ["Wrapped", "Flat", "Colors", "Indirect", "Widened"],
          },
        }),
      })) as ToolResult;

      const details = detailsOf(result);
      const literalsOf = (name: string): string[] | undefined =>
        details.nodes.find((node) => node.name === name)?.literals;

      const wrapped = literalsOf("Wrapped");
      const flat = literalsOf("Flat");
      const seven = ['"a"', '"b"', '"c"', '"d"', '"e"', '"f"', '"g"'];

      // The reported case: seven members, one per line, past the old six-member
      // cap and the old four-line signature window.
      assert.deepStrictEqual(
        wrapped,
        seven,
        `the wrapped union reports every member it admits: ${JSON.stringify(wrapped)}`,
      );
      // The same type, wrapped differently, is the same answer.
      assert.deepStrictEqual(
        flat,
        seven,
        `line wrapping does not change the value set: ${JSON.stringify(flat)}`,
      );
      // A multi-line enum used to report nothing: its signature stops at `{`, and
      // its members are not nodes, so `literals` is their only carrier.
      assert.deepStrictEqual(
        literalsOf("Colors"),
        ['"red"', '"green"', '"blue"'],
        `the enum reports its member values: ${JSON.stringify(literalsOf("Colors"))}`,
      );
      // Indirection: the seven members reaching Indirect through Wrapped are its
      // own, though no token of its declaration names them.
      assert.deepStrictEqual(
        literalsOf("Indirect"),
        [...seven, '"h"'],
        `alias indirection resolves: ${JSON.stringify(literalsOf("Indirect"))}`,
      );
      // The negative twin: this type admits every other string too, so a
      // seven-value answer would read as complete while being false.
      assert.strictEqual(
        literalsOf("Widened"),
        undefined,
        `a union widened by string reports no value set: ${JSON.stringify(literalsOf("Widened"))}`,
      );
      // None of these are truncated, so the marker must stay off.
      assert.ok(
        details.nodes.every((node) => node.literalsTruncated !== true),
        "no value set here is capped, so nothing is marked truncated",
      );
    } finally {
      client.endStdin();
      await client.waitForExit();
    }
  };
