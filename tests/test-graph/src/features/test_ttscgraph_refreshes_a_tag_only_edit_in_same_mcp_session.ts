import fs from "node:fs";
import path from "node:path";

import { withIdentityBoundary } from "../internal/identityBoundary";
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
 *
 * @evidence contracts/testing.md#behavioral-verification MCP citation lookup initially finds subject under one address, then a comment-only edit moves it to the new address and removes the old hit in the same session.
 * @evidence contracts/testing.md#independent-expectations The two literal tag addresses and unchanged executable body define the independent expectation; content hashing only semantic code would miss this edit.
 * @evidence contracts/testing.md#distinguishing-cases Only documentation changes, contrasting new-target presence with old-target absence while declaration identity and body stay fixed.
 * @evidence contracts/testing.md#execution-ownership The features export test_ttscgraph_refreshes_a_tag_only_edit_in_same_mcp_session starts the installed MCP launcher and reaches the native resident graph through stdio; it remains in the E2E runner/Evidence population, with the per-case assertions above rather than source-unit execution.
 * @evidence contracts/e2e.md#necessary-boundary Native incremental comment extraction, generation replacement and resident citation reindexing must respond to a non-code edit without a new MCP client.
 * @evidence contracts/e2e.md#shared-execution Thirty-one native graph entries share one project: twenty-eight borrow one initialized MCP/native session, and four immutable producer assertions borrow one cached public CLI dump (checker uses both). Raw-only selections prepare no MCP. MCP ranking, exact tag queries and recursive/terminal/dispatch-threshold contrasts select closed source universes; edits and config restoration advance actual generations without fresh clients.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Disjoint files, contracts, citations, aliases, external declarations and a physical workspace link preserve distinctions. MCP/tag scopes and invalid-config recovery restore config bytes finally; tour/hub variants overwrite only their own source and scope include to that file, retaining exact population/order/topology before each native request. Cached CLI facts serve unchanged assertions, and suite finally joins its client after complete collection.
 * @evidence contracts/e2e.md#preserved-coverage Original subject membership, new address membership and empty old address assertions remain, preserving tag-only invalidation rather than replacing it with a cold run.
 */
export const test_ttscgraph_refreshes_a_tag_only_edit_in_same_mcp_session =
  async () => {
    await withIdentityBoundary(async (client, root) => {

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
        path.join(root, "src", "tag-refresh.ts"),
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
    }, ["src/tag-refresh.ts"]);
  };
