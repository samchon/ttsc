import fs from "node:fs";
import path from "node:path";

import { withIdentityBoundary } from "../../../internal/graph/internal/identityBoundary";
import { TtsgraphClient, assert } from "../../../internal/graph/internal/ttsgraph";

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
 * @evidence contracts/testing.md#execution-ownership Called by test_e2e_graph, the exported scene case_ttscgraph_refreshes_changed_source_in_same_mcp_session borrows the experiment's shared installed MCP/native session and drives its actual stdio connection; it remains in the E2E runner/Evidence population, with the per-case assertions above rather than source-unit execution.
 * @evidence contracts/e2e.md#necessary-boundary Resident compiler source invalidation and MCP model refresh must update facts between requests; a freshly constructed memory model cannot prove this lifetime transition.
 * @evidence contracts/e2e.md#shared-execution Identity consumers share one project and resident MCP/native session. Immutable producer assertions and installed decoders borrow one cached CLI dump; checker dispatch uses both. Raw dump preparation alone starts no MCP. Cold escape and a controlled unlinked transition reuse the identity project, with one additional dump for changed membership. Ranking, tag and tour/hub inputs retain closed source universes; edits and config restoration advance actual generations without fresh clients.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Disjoint files, contracts, citations, aliases, external declarations and a physical workspace link preserve distinctions. MCP/tag scopes and invalid-config recovery restore config bytes after settled requests; a timed-out or lost transport forbids further edits and resets, withdraws reuse and retains both project and external receipt inputs until the experiment attempts actual child joins. Tour/hub variants overwrite only their own source and scope include to that file, retaining exact population/order/topology. Cached CLI facts serve unchanged assertions.
 * @evidence contracts/e2e.md#preserved-coverage Before baseline, After presence and Before absence remain executable in one session. No fresh-client workaround or weaker presence-only check replaces them.
 */
export const case_ttscgraph_refreshes_changed_source_in_same_mcp_session =
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
