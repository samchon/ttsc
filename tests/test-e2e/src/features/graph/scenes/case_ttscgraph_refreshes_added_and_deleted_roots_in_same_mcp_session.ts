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
 * @evidence contracts/testing.md#behavioral-verification MCP lookup sees OriginalRoot, then a newly added AddedRoot, and finally stops returning OriginalRoot after its source file is deleted, all through one client.
 * @evidence contracts/testing.md#independent-expectations Literal fixture names and physical add/delete operations independently specify the expected root set; stale snapshots cannot satisfy both changes.
 * @evidence contracts/testing.md#distinguishing-cases An included root is added and another removed without reopening MCP, contrasting both expansion and contraction of the compiler project.
 * @evidence contracts/testing.md#execution-ownership Called by test_e2e_graph, the exported scene case_ttscgraph_refreshes_added_and_deleted_roots_in_same_mcp_session borrows the shared workspace-built MCP launcher and explicitly selected real native session, not a consumer-local packed SDK installation and drives its actual stdio connection; it remains in the E2E runner/Evidence population, with the per-case assertions above rather than source-unit execution.
 * @evidence contracts/e2e.md#necessary-boundary Resident compiler root discovery, refreshed snapshot transport and application lookup must reflect filesystem changes; direct lookup over fixed nodes cannot exercise that connection.
 * @evidence contracts/e2e.md#shared-execution OriginalRoot baseline, physical AddedRoot appearance and original-file deletion are queried through the same identity MCP/native client. These actual root transitions require refreshed responses, not another client; client reuse does not prove Program object reuse or construction counts. Neighboring cached CLI facts do not supply these lookup results.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Original file bytes and added-file bytes or actual ENOENT absence are captured before requests. Actual client authority is required before add/delete and each independent finally restoration. Operation and all reset failures are collected; failed reset withdraws reuse. Unconfirmed transport forbids further edits/reset and retains inputs until owned joins establish cleanup authority.
 * @evidence contracts/e2e.md#preserved-coverage All baseline OriginalRoot, added AddedRoot and deleted OriginalRoot-absence assertions remain here; a new-session result would not preserve the resident refresh distinction.
 */
export const case_ttscgraph_refreshes_added_and_deleted_roots_in_same_mcp_session =
  async () => {
    await withIdentityBoundary(async (client, root) => {
      const originalFile = path.join(root, "src", "original.ts");
      const addedFile = path.join(root, "src", "added.ts");
      const originalSource = fs.readFileSync(originalFile);
      let addedSource: Buffer | undefined;
      try {
        addedSource = fs.readFileSync(addedFile);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
      const failures: unknown[] = [];
      try {

        assert.ok(
          (await lookup(client, "OriginalRoot")).includes("OriginalRoot"),
        );
        client.assertInputMutationAllowed();
        fs.writeFileSync(
          path.join(root, "src", "added.ts"),
          "export class AddedRoot {}\n",
        );
        assert.ok((await lookup(client, "AddedRoot")).includes("AddedRoot"));

        client.assertInputMutationAllowed();
        fs.rmSync(path.join(root, "src", "original.ts"));
        assert.ok(
          !(await lookup(client, "OriginalRoot")).includes("OriginalRoot"),
        );
      } catch (error) {
        failures.push(error);
      } finally {
        for (const [file, bytes] of [
          [originalFile, originalSource],
          [addedFile, addedSource],
        ] as const) {
          try {
            client.assertInputMutationAllowed();
            if (bytes === undefined) fs.rmSync(file, { force: true });
            else fs.writeFileSync(file, bytes);
          } catch (error) {
            client.preventInputReuse("Added/deleted root restoration failed");
            failures.push(error);
          }
        }
      }
      if (failures.length === 1) throw failures[0];
      if (failures.length > 1)
        throw new AggregateError(failures, "Root refresh requests and resets failed");
    });
  };
