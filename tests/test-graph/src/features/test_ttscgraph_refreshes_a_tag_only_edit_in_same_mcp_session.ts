import { TestProject } from "@ttsc/testing";
import fs from "node:fs";
import path from "node:path";

import { TtsgraphClient, assert } from "../internal/ttsgraph";

interface ToolResult {
  content: { type: string; text: string }[];
  structuredContent?: unknown;
}

const lookupArguments = (query: string) => ({
  question: `Which code implements ${query}?`,
  draft: {
    reason: "A documentation target is the smallest useful graph request.",
    type: "lookup",
  },
  review: "Confirmed: use one lookup against the current source snapshot.",
  request: {
    type: "lookup",
    query,
  },
});

const lookupNames = (result: ToolResult): string[] => {
  const value = (result.structuredContent ?? {}) as {
    result?: { type?: string; hits?: { name?: string }[] };
  };
  assert.equal(value.result?.type, "lookup", JSON.stringify(value));
  return (value.result?.hits ?? []).flatMap((hit) =>
    typeof hit.name === "string" ? [hit.name] : [],
  );
};

/**
 * Verifies an edit that changes only a documentation tag refreshes the resident
 * graph, and moves the citation index with it.
 *
 * A tag lives in a comment, so every layer that decides what to rebuild — the
 * source digest, the shard partition, the reverse index built from the loaded
 * nodes — could plausibly treat the edit as nothing. Then an agent that
 * re-pointed a citation at the section it now implements would keep being told
 * the old one, which is worse than not answering: the index would be
 * confidently wrong about the one relation it exists to hold.
 *
 * 1. Start one MCP server over a declaration citing `docs/one.md#first`.
 * 2. Rewrite only the tag, to `docs/two.md#second`.
 * 3. Assert the new address answers and the old one no longer does, in the same
 *    session.
 */
export const test_ttscgraph_refreshes_a_tag_only_edit_in_same_mcp_session =
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
        "/** @evidence docs/one.md#first The section this implements. */",
        "export function subject(): void {}",
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

      const lookup = async (query: string): Promise<string[]> =>
        lookupNames(
          (await client.request("tools/call", {
            name: "inspect_typescript_graph",
            arguments: lookupArguments(query),
          })) as ToolResult,
        );

      assert.deepStrictEqual(
        await lookup("docs/one.md#first"),
        ["subject"],
        "the original address must answer before the edit",
      );

      // Only the comment changes: the declaration below it is byte-identical.
      fs.writeFileSync(
        path.join(root, "src", "app.ts"),
        [
          "/** @evidence docs/two.md#second The section this implements. */",
          "export function subject(): void {}",
          "",
        ].join("\n"),
        "utf8",
      );

      assert.deepStrictEqual(
        await lookup("docs/two.md#second"),
        ["subject"],
        "the new address must answer without restarting the session",
      );
      assert.deepStrictEqual(
        await lookup("docs/one.md#first"),
        [],
        "the replaced address must stop answering",
      );
    } finally {
      // Closing stdin is what asks the server to exit, so it belongs here: a
      // failing assertion above must not leave a resident compiler behind.
      client.endStdin();
    }

    // The refresh has to leave the session healthy, not merely answer: a graph
    // that reloads correctly and then crashes its native child on shutdown
    // would pass every assertion above. Awaited outside the block because
    // waiting twice on one child is what times out.
    assert.equal(await client.waitForExit(), 0, client.stderrText());
  };
