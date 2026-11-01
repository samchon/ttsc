import assert from "node:assert/strict";

import { parseTtsxCLI } from "../../../../../packages/ttsc/src/launcher/internal/parseTtsxCLI";

/**
 * Verifies no-cache is launcher policy only before the source entry.
 *
 * 1. Parse default, enabled and explicit false launcher requests.
 * 2. Parse the same spelling after the source entry.
 * 3. Assert only launcher requests change policy and no flag reaches tsgo.
 *
 * @evidence contracts/testing.md#behavioral-verification The actual launcher parser returns the policy and compiler/program projections used by runTtsx.
 * @evidence contracts/testing.md#independent-expectations The CLI contract fixes default false, explicit true/false and exact program-tail preservation independently of parser internals.
 * @evidence contracts/testing.md#distinguishing-cases Omitted, true, false and post-entry spellings distinguish launcher consumption from compiler forwarding and program argv.
 * @evidence contracts/testing.md#execution-ownership The test-ttsc unit runner discovers the named export and calls the pure authored parser without a runtime host.
 */
export function test_parse_ttsx_cli_consumes_no_cache_only_before_the_entry(): void {
  for (const [args, expected] of [
    [["main.ts"], false],
    [["--no-cache", "main.ts"], true],
    [["--no-cache", "false", "main.ts"], false],
  ] as const) {
    const result = parseTtsxCLI(args);
    assert.notEqual(typeof result, "string");
    if (typeof result === "string")
      throw new Error("unexpected terminal request");
    assert.equal(result.noCache, expected);
    assert.deepEqual(result.tsgoFlags, []);
  }
  const tail = parseTtsxCLI(["main.ts", "--no-cache"]);
  if (typeof tail === "string") throw new Error("unexpected terminal request");
  assert.equal(tail.noCache, false);
  assert.deepEqual(tail.passthrough, ["--no-cache"]);
}
