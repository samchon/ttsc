import fs from "node:fs";
import path from "node:path";

import { withIdentityBoundary } from "../../../internal/graph/internal/identityBoundary";
import {
  TtsgraphClient,
  assert,
} from "../../../internal/graph/internal/ttsgraph";

interface ToolResult {
  isError?: boolean;
  content: { type: string; text: string }[];
  structuredContent?: unknown;
}

const GRAPH_TOOL_NAME = "inspect_typescript_graph";

const lookupArguments = (query: string) => ({
  question: `Look up ${query} in the synchronized TypeScript graph.`,
  draft: {
    reason: "A named lookup is the smallest graph request.",
    type: "lookup",
  },
  review: "Confirmed: use the current graph snapshot.",
  request: { type: "lookup", query },
});

/**
 * Verifies MCP graph calls fail closed on an invalid config and recover later.
 *
 * A refresh error must never make the server return its previous valid graph as
 * if it described the current project. The native session remains retryable so
 * an agent can fix the config and use the same MCP process afterward.
 *
 * 1. Build an initial graph, then corrupt tsconfig.json.
 * 2. Assert the next tool result is an error rather than stale graph evidence.
 * 3. Restore the config and assert the same server answers successfully again.
 *
 * @evidence contracts/testing.md#behavioral-verification MCP graph access succeeds, reports isError with an invalid project configuration after corruption, then succeeds again and returns Recoverable after restoration in the same session.
 * @evidence contracts/testing.md#independent-expectations Malformed JSON cannot define a valid project; the literal error text and restored declaration name independently require fail-closed rejection and recovery.
 * @evidence contracts/testing.md#distinguishing-cases Valid, invalid and restored configuration states contrast within one live client. The initial success assertion checks the error flag, not a baseline declaration payload.
 * @evidence contracts/testing.md#execution-ownership Called by test_e2e_graph, the exported scene case_ttscgraph_fails_closed_for_invalid_config_and_recovers borrows the experiment's shared installed MCP/native session and drives its actual stdio connection; it remains in the E2E runner/Evidence population, with the per-case assertions above rather than source-unit execution.
 * @evidence contracts/e2e.md#necessary-boundary The actual launcher, resident compiler refresh and MCP error conversion must reject invalid config without serving old facts and recover without restarting the client.
 * @evidence contracts/e2e.md#shared-execution Identity consumers share one project and resident MCP/native session. Immutable producer assertions and installed decoders borrow one cached CLI dump; checker dispatch uses both. Raw dump preparation alone starts no MCP. Cold escape and a controlled unlinked transition reuse the identity project, with one additional dump for changed membership. Ranking, tag and tour/hub inputs retain closed source universes; edits and config restoration advance actual generations without fresh clients.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Disjoint files, contracts, citations, aliases, external declarations and a physical workspace link preserve distinctions. MCP/tag scopes and invalid-config recovery restore config bytes after settled requests; a timed-out or lost transport forbids further edits and resets, withdraws reuse and retains both project and external receipt inputs until the experiment attempts actual child joins. Tour/hub variants overwrite only their own source and scope include to that file, retaining exact population/order/topology. Cached CLI facts serve unchanged assertions.
 * @evidence contracts/e2e.md#preserved-coverage Initial non-error, invalid error/message and recovered non-error/name assertions remain. The baseline oracle does not establish every initial graph fact.
 */
export const case_ttscgraph_fails_closed_for_invalid_config_and_recovers =
  async () => {
    await withIdentityBoundary(async (client, root) => {
      const initial = (await client.request("tools/call", {
        name: GRAPH_TOOL_NAME,
        arguments: lookupArguments("Recoverable"),
      })) as ToolResult;
      assert.equal(initial.isError, undefined, initial.content[0]?.text);

      const config = path.join(root, "tsconfig.json");
      const original = fs.readFileSync(config);
      const failures: unknown[] = [];
      try {
        fs.writeFileSync(config, "{ invalid");
        const invalid = (await client.request("tools/call", {
          name: GRAPH_TOOL_NAME,
          arguments: lookupArguments("Recoverable"),
        })) as ToolResult;
        assert.equal(invalid.isError, true, JSON.stringify(invalid));
        assert.match(invalid.content[0]?.text ?? "", /invalid project/i);

        fs.writeFileSync(config, original);
        const recovered = (await client.request("tools/call", {
          name: GRAPH_TOOL_NAME,
          arguments: lookupArguments("Recoverable"),
        })) as ToolResult;
        assert.equal(recovered.isError, undefined, recovered.content[0]?.text);
        assert.match(
          JSON.stringify(recovered.structuredContent ?? {}),
          /Recoverable/,
        );
      } catch (error) {
        failures.push(error);
      } finally {
        try {
          client.assertInputMutationAllowed();
          fs.writeFileSync(config, original);
        } catch (error) {
          client.preventInputReuse(
            "Invalid-config recovery restoration failed",
          );
          failures.push(error);
        }
      }
      if (failures.length === 1) throw failures[0];
      if (failures.length > 1)
        throw new AggregateError(
          failures,
          "Invalid-config recovery and reset failed",
        );
    });
  };
