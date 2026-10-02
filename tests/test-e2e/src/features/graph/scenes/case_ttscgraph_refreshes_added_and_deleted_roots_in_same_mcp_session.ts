import fs from "node:fs";
import path from "node:path";

import { withIdentityBoundary } from "../../../internal/graph/internal/identityBoundary";
import { TtsgraphClient, assert } from "../../../internal/graph/internal/ttsgraph";

interface ToolResult {
  content: { type: string; text: string }[];
  structuredContent?: unknown;
}

const GRAPH_TOOL_NAME = "inspect_typescript_graph";

const lookup = async (
  client: ReturnType<typeof TtsgraphClient.start>,
  query: string,
): Promise<string[]> => {
  const result = (await client.request("tools/call", {
    name: GRAPH_TOOL_NAME,
    arguments: {
      question: `Look up ${query} in the current TypeScript project roots.`,
      draft: {
        reason: "A named symbol lookup is the smallest graph request.",
        type: "lookup",
      },
      review: "Confirmed: query the synchronized graph once.",
      request: { type: "lookup", query },
    },
  })) as ToolResult;
  const value = (result.structuredContent ?? {}) as {
    result?: { type?: string; hits?: { name?: string }[] };
  };
  assert.equal(value.result?.type, "lookup", JSON.stringify(value));
  return (value.result?.hits ?? []).flatMap((hit) =>
    typeof hit.name === "string" ? [hit.name] : [],
  );
};

/**
 * Verifies one MCP session refreshes tsconfig root additions and deletions.
 *
 * Content hashing existing Program files cannot discover a new include-glob
 * match, and an incremental single-file replacement cannot remove a deleted
 * root. The resident native session must compare parsed root sets and safely
 * reload before each affected tool response.
 *
 * 1. Start one server over an include-glob project containing `OriginalRoot`.
 * 2. Add `AddedRoot` in a second file and assert it is immediately searchable.
 * 3. Delete the original file and assert its declaration disappears.
 *
 * @evidence contracts/testing.md#behavioral-verification MCP lookup sees Original, then a newly added Added root, and finally stops returning Original after its source file is deleted, all through one client.
 * @evidence contracts/testing.md#independent-expectations Literal fixture names and physical add/delete operations independently specify the expected root set; stale snapshots cannot satisfy both changes.
 * @evidence contracts/testing.md#distinguishing-cases An included root is added and another removed without reopening MCP, contrasting both expansion and contraction of the compiler project.
 * @evidence contracts/testing.md#execution-ownership Called by test_e2e_graph, the exported scene case_ttscgraph_refreshes_added_and_deleted_roots_in_same_mcp_session borrows the experiment's shared installed MCP/native session and drives its actual stdio connection; it remains in the E2E runner/Evidence population, with the per-case assertions above rather than source-unit execution.
 * @evidence contracts/e2e.md#necessary-boundary Resident compiler root discovery, refreshed snapshot transport and application lookup must reflect filesystem changes; direct lookup over fixed nodes cannot exercise that connection.
 * @evidence contracts/e2e.md#shared-execution Identity consumers share one project and resident MCP/native session. Immutable producer assertions and installed decoders borrow one cached CLI dump; checker dispatch uses both. Raw dump preparation alone starts no MCP. Cold escape and a controlled unlinked transition reuse the identity project, with one additional dump for changed membership. Ranking, tag and tour/hub inputs retain closed source universes; edits and config restoration advance actual generations without fresh clients.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Disjoint files, contracts, citations, aliases, external declarations and a physical workspace link preserve distinctions. MCP/tag scopes and invalid-config recovery restore config bytes after settled requests; a timed-out or lost transport forbids further edits and resets, withdraws reuse and retains both project and external receipt inputs until the experiment attempts actual child joins. Tour/hub variants overwrite only their own source and scope include to that file, retaining exact population/order/topology. Cached CLI facts serve unchanged assertions.
 * @evidence contracts/e2e.md#preserved-coverage All baseline Original, added Added and deleted Original-absence assertions remain here; a new-session result would not preserve the resident refresh distinction.
 */
export const case_ttscgraph_refreshes_added_and_deleted_roots_in_same_mcp_session =
  async () => {
    await withIdentityBoundary(async (client, root) => {

      assert.ok(
        (await lookup(client, "OriginalRoot")).includes("OriginalRoot"),
      );
      fs.writeFileSync(
        path.join(root, "src", "added.ts"),
        "export class AddedRoot {}\n",
      );
      assert.ok((await lookup(client, "AddedRoot")).includes("AddedRoot"));

      fs.rmSync(path.join(root, "src", "original.ts"));
      assert.ok(
        !(await lookup(client, "OriginalRoot")).includes("OriginalRoot"),
      );
    });
  };
