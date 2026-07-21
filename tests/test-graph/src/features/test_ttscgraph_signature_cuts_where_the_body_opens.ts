import { TestProject } from "@ttsc/testing";

import { TtsgraphClient, assert } from "../internal/ttsgraph";

interface ToolResult {
  content: { type: string; text: string }[];
  structuredContent?: unknown;
}

interface DetailsResult {
  type: "details";
  nodes: { name: string; signature?: string }[];
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
 * Verifies a signature is the declaration head, cut where the body opens.
 *
 * The head used to be reconstructed by scanning whole physical lines and
 * stopping at the first one holding a `{` or ending in `;`. A line is not a
 * declaration boundary and a brace is not always a body, so the same rule
 * failed in both directions: a declaration sharing its line with its body
 * emitted the implementation as part of its signature, and a head containing a
 * brace of its own — a type-literal parameter, an object return type — was cut
 * at that brace and lost its remaining parameters and its return type.
 *
 * The compiler knows where the body starts, so the producer cuts there.
 *
 * 1. Declare a one-line function and a function whose parameter is a type literal.
 * 2. Ask for details on both.
 * 3. Assert the first carries no body statement and the second keeps the parameter
 *    it used to lose along with its return type.
 */
export const test_ttscgraph_signature_cuts_where_the_body_opens = async () => {
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
      "export function oneLiner(n: number): number { return n * 2; }",
      "",
      "export function withTypeLiteral(options: {",
      "  host: string;",
      "  port: number;",
      "}): Promise<void> {",
      "  return Promise.resolve();",
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

    const result = (await client.request("tools/call", {
      name: "inspect_typescript_graph",
      arguments: graphArguments({
        thinking: "What are these two functions?",
        request: { type: "details", handles: ["oneLiner", "withTypeLiteral"] },
      }),
    })) as ToolResult;

    const details = detailsOf(result);
    const signatureOf = (name: string): string => {
      const node = details.nodes.find((n) => n.name.endsWith(name));
      assert.ok(node !== undefined, `no details node for ${name}`);
      assert.ok(node.signature !== undefined, `${name} carries no signature`);
      return node.signature;
    };

    const oneLiner = signatureOf("oneLiner");
    assert.ok(
      !oneLiner.includes("return n * 2"),
      `a body on the declaration's own line leaked into the signature: ${oneLiner}`,
    );
    assert.ok(
      oneLiner.includes("n: number"),
      `the one-line declaration lost its parameter: ${oneLiner}`,
    );

    const typeLiteral = signatureOf("withTypeLiteral");
    assert.ok(
      typeLiteral.includes("port: number"),
      `the head was cut at its own brace: ${typeLiteral}`,
    );
    assert.ok(
      typeLiteral.includes("Promise<void>"),
      `the head lost its return type: ${typeLiteral}`,
    );
    assert.ok(
      !typeLiteral.includes("Promise.resolve()"),
      `the body leaked into the signature: ${typeLiteral}`,
    );
  } finally {
    client.endStdin();
    await client.waitForExit();
  }
};
