import fs from "node:fs";
import path from "node:path";

import { withIdentityBoundary } from "../../internal/graph/internal/identityBoundary";
import { TtsgraphClient, assert } from "../../internal/graph/internal/ttsgraph";

interface ToolResult {
  content: { type: string; text: string }[];
  structuredContent?: unknown;
}

const GRAPH_TOOL_NAME = "inspect_typescript_graph";

const lookupArguments = (query: string) => ({
  question: `Look up ${query} in the current TypeScript source snapshot.`,
  draft: {
    reason: "A named symbol lookup is the smallest useful graph request.",
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
 * Verifies the MCP graph refreshes a changed source file in the same session.
 *
 * Locks the stale resident-index failure in `startServer`: caching the first
 * dump forever makes every later tool call return declarations from before an
 * agent edit. The second lookup must observe the current disk snapshot without
 * restarting the MCP process.
 *
 * 1. Start one MCP server and look up an exported `BeforeEdit` class.
 * 2. Replace that declaration on disk with `AfterEdit` in the same source file.
 * 3. Look up both names and assert only the post-edit declaration remains.
 *
 * @evidence contracts/testing.md#behavioral-verification MCP lookup returns Before, then after replacing the source returns After and no Before within the same live session.
 * @evidence contracts/testing.md#independent-expectations Literal before/after declaration names and the physical source replacement define the expected generation; no result is derived from a returned snapshot.
 * @evidence contracts/testing.md#distinguishing-cases Positive new-name and negative old-name results contrast the initial baseline, detecting stale addition and stale deletion together.
 * @evidence contracts/testing.md#execution-ownership The features export test_ttscgraph_refreshes_changed_source_in_same_mcp_session starts the installed MCP launcher and reaches the native resident graph through stdio; it remains in the E2E runner/Evidence population, with the per-case assertions above rather than source-unit execution.
 * @evidence contracts/e2e.md#necessary-boundary Resident compiler source invalidation and MCP model refresh must update facts between requests; a freshly constructed memory model cannot prove this lifetime transition.
 * @evidence contracts/e2e.md#shared-execution Thirty-two identity entries share one project: twenty-eight borrow one initialized MCP/native session; four producer assertion entries and the installed decoder case borrow one cached public CLI dump (checker uses both). Raw-only selections prepare no MCP. MCP ranking, exact tag queries and tour/hub contrasts select closed source universes; edits and config restoration advance actual generations without fresh clients.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Disjoint files, contracts, citations, aliases, external declarations and a physical workspace link preserve distinctions. MCP/tag scopes and invalid-config recovery restore config bytes finally; tour/hub variants overwrite only their own source and scope include to that file, retaining exact population/order/topology before each native request. Cached CLI facts serve unchanged assertions, and suite finally joins its client after complete collection.
 * @evidence contracts/e2e.md#preserved-coverage Before baseline, After presence and Before absence remain executable in one session. No fresh-client workaround or weaker presence-only check replaces them.
 */
export const test_ttscgraph_refreshes_changed_source_in_same_mcp_session =
  async () => {
    await withIdentityBoundary(async (client, root) => {

      const before = lookupNames(
        (await client.request("tools/call", {
          name: GRAPH_TOOL_NAME,
          arguments: lookupArguments("BeforeEdit"),
        })) as ToolResult,
      );
      assert.ok(before.includes("BeforeEdit"), JSON.stringify(before));

      fs.writeFileSync(
        path.join(root, "src", "source-refresh.ts"),
        "export class AfterEdit {}\n",
      );

      const after = lookupNames(
        (await client.request("tools/call", {
          name: GRAPH_TOOL_NAME,
          arguments: lookupArguments("AfterEdit"),
        })) as ToolResult,
      );
      assert.ok(after.includes("AfterEdit"), JSON.stringify(after));

      const stale = lookupNames(
        (await client.request("tools/call", {
          name: GRAPH_TOOL_NAME,
          arguments: lookupArguments("BeforeEdit"),
        })) as ToolResult,
      );
      assert.ok(!stale.includes("BeforeEdit"), JSON.stringify(stale));
    });
  };
