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
 * @evidence contracts/testing.md#execution-ownership Called by test_e2e_graph, the exported scene case_ttscgraph_fails_closed_for_invalid_config_and_recovers borrows the experiment's shared built workspace MCP/native session and drives its actual stdio connection with the explicit workspace binary override; this is not a consumer-local packed SDK installation. It remains in the E2E runner/Evidence population, with the per-case assertions above rather than source-unit execution.
 * @evidence contracts/e2e.md#necessary-boundary The actual launcher, resident compiler refresh and MCP error conversion must reject invalid config without serving old facts and recover without restarting the client.
 * @evidence contracts/e2e.md#shared-execution Valid, malformed and restored config requests reuse the built workspace MCP/native identity client and the unchanged Recoverable declaration. Configuration changes may replace compiler generations even though the client is unchanged; no Program-object reuse, total construction/process count or packed publication identity is certified. Neighboring immutable observers use a separate cached CLI dump rather than substituting it for these live refresh responses.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The original config bytes are captured, and the actual client must permit mutation before corruption, recovery restore and finally restore. All tool requests settle before the next permitted write; operation and finally restoration failures are collected, with input reuse withdrawn on failed restore. A timed-out or lost transport forbids subsequent edits/resets and retains project and external receipt inputs through the outer boundary until actual child joins are attempted.
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
        client.assertInputMutationAllowed();
        fs.writeFileSync(config, "{ invalid");
        const invalid = (await client.request("tools/call", {
          name: GRAPH_TOOL_NAME,
          arguments: lookupArguments("Recoverable"),
        })) as ToolResult;
        assert.equal(invalid.isError, true, JSON.stringify(invalid));
        assert.match(invalid.content[0]?.text ?? "", /invalid project/i);

        client.assertInputMutationAllowed();
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
