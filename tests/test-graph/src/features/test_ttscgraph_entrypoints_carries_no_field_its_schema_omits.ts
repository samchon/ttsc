import { TestProject } from "@ttsc/testing";

import { TtsgraphClient, assert } from "../internal/ttsgraph";

interface ToolResult {
  content: { type: string; text: string }[];
  structuredContent?: unknown;
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

/**
 * Verifies `entrypoints` returns no documentation tags, because its own result
 * shape declares none.
 *
 * It builds its hits by copying `lookup`'s, and `lookup` may carry the tags
 * that matched a citation query. Copying the hit wholesale therefore put a
 * field on the wire that this result's schema does not describe — invisible to
 * every assertion about entrypoints, and exactly the kind of drift a typed
 * contract exists to prevent.
 *
 * The query has to be one that reaches the citation path, or the assertion is
 * vacuous: `entrypoints` inherits the field only when `lookup` would have
 * produced it, and a plain symbol name produces none. So the same address is
 * asked of both operations, and `lookup` carrying the field is what proves the
 * `entrypoints` absence is the schema being kept rather than nothing
 * happening.
 *
 * 1. Materialize a project whose entry declaration carries a documentation tag.
 * 2. Ask both operations for the address that tag names.
 * 3. Assert `lookup` carries the field, `entrypoints` does not, and `details`
 *    still returns the tag.
 */
export const test_ttscgraph_entrypoints_carries_no_field_its_schema_omits =
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
      "src/main.ts": [
        "/** @evidence docs/boot.md#start Starts the application. */",
        "export function bootstrap(): void {",
        "  run();",
        "}",
        "",
        "/** Does the work. */",
        "export function run(): void {}",
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
      ): Promise<Record<string, unknown>> => {
        const result = (await client.request("tools/call", {
          name: "inspect_typescript_graph",
          arguments: graphArguments({
            thinking: "Where does this application start?",
            request,
          }),
        })) as ToolResult;
        const value = (result.structuredContent ?? {}) as {
          result?: Record<string, unknown>;
        };
        if (value.result === undefined)
          // The tool validates its own output, so an undeclared property is
          // rejected before the result is built and this is where a schema
          // drift surfaces. Carry the whole payload out, or the failure names
          // the absence and not the field that caused it.
          throw new Error(
            `The graph returned no result for ${JSON.stringify(request)}. ` +
              `Payload: ${JSON.stringify(result)}`,
          );
        return value.result;
      };

      const address = "docs/boot.md#start";

      // The control. Without this the assertion below proves nothing: a plain
      // name reaches no citation, so `entrypoints` would carry no tag whatever
      // the copy did.
      const lookup = (await call({ type: "lookup", query: address })) as {
        hits?: Record<string, unknown>[];
      };
      assert.ok(
        (lookup.hits ?? []).some((hit) => "docTags" in hit),
        `lookup must carry the matching tag for this query: ${JSON.stringify(lookup.hits)}`,
      );

      const entrypoints = (await call({
        type: "entrypoints",
        query: address,
      })) as { hits?: Record<string, unknown>[] };
      assert.ok(
        (entrypoints.hits ?? []).length > 0,
        "the fixture must produce at least one entrypoint hit to assert about",
      );
      assert.deepStrictEqual(
        (entrypoints.hits ?? []).filter((hit) => "docTags" in hit),
        [],
        "an entrypoints hit must not carry a field its result shape omits",
      );

      // The negative twin: the tag is present, and the operation whose schema
      // declares it does return it. The absence above is the contract being
      // kept, not the fact going missing.
      const details = (await call({
        type: "details",
        handles: ["bootstrap"],
      })) as { nodes?: Record<string, unknown>[] };
      assert.ok(
        (details.nodes ?? []).some((node) => "docTags" in node),
        `details must still carry the tag: ${JSON.stringify(details.nodes)}`,
      );
    } finally {
      client.endStdin();
    }

    assert.equal(await client.waitForExit(), 0, client.stderrText());
  };
