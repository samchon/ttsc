import { TestProject } from "@ttsc/testing";
import fs from "node:fs";
import path from "node:path";

import { TtsgraphClient, assert } from "../internal/ttsgraph";

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
 * @evidence contracts/testing.md#execution-ownership The features export test_ttscgraph_refreshes_added_and_deleted_roots_in_same_mcp_session starts the installed MCP launcher and reaches the native resident graph through stdio; it remains in the E2E runner/Evidence population, with the per-case assertions above rather than source-unit execution.
 * @evidence contracts/e2e.md#necessary-boundary Resident compiler root discovery, refreshed snapshot transport and application lookup must reflect filesystem changes; direct lookup over fixed nodes cannot exercise that connection.
 * @evidence contracts/e2e.md#shared-execution One project and MCP/compiler lifetime is essential to observe invalidation rather than cold reload. The suite binary is shared, and stable cases could share other preparation; full batching is incomplete.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The case owns its mutable source directory and changes it only after each baseline response; stdin closes in finally and the success path checks exit.
 * @evidence contracts/e2e.md#preserved-coverage All baseline Original, added Added and deleted Original-absence assertions remain here; a new-session result would not preserve the resident refresh distinction.
 */
export const test_ttscgraph_refreshes_added_and_deleted_roots_in_same_mcp_session =
  async () => {
    const root = TestProject.createProject({
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "commonjs",
          strict: true,
        },
        include: ["src"],
      }),
      "src/original.ts": "export class OriginalRoot {}\n",
    });
    const client = TtsgraphClient.start(root);
    try {
      await client.request("initialize", {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "test-graph", version: "0.0.0" },
      });
      client.notify("notifications/initialized", {});

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
    } finally {
      client.endStdin();
    }

    assert.equal(await client.waitForExit(), 0, client.stderrText());
  };
