import assert from "node:assert/strict";
import { TtscGraphLauncherArguments as Arguments } from "../../../../packages/graph/src/TtscGraphLauncherArguments";
/**
 * Verifies caller artifact values retain native grammar and precedence.
 *
 * The dump launcher must treat the caller's artifact destination as a string
 * operand of the native flag grammar. Separate, equals and single- or double-dash
 * spellings, empty values and dash-leading filenames reach the producer unchanged
 * and suppress the automatic path.
 *
 * 1. Parse ten caller spellings of the artifact flag and require each dump vector
 *    to forward them unchanged after the dump verb.
 * 2. Require an argument list without the flag to receive the automatic
 *    publication path.
 * 3. Require a missing operand and an unknown option to throw.
 *
 * @evidence contracts/testing.md#behavioral-verification The actual launcher parser and dump vector owner process separate, equals, aliases, repeated, empty and dash-valued tokens.
 * @evidence contracts/testing.md#independent-expectations Literal original argv must be forwarded unchanged and explicit artifacts must suppress a separately authored automatic publication path.
 * @evidence contracts/testing.md#distinguishing-cases All option spellings, last-value precedence, empty strings, a dash-valued filename, missing argument and unknown option distinguish string grammar from generic path grammar.
 * @evidence contracts/testing.md#execution-ownership This exported src/features entry executes the owning source operations in this test process, without installing a consumer, building a native producer or fabricating process protocol replies.
 */
export function test_dump_artifacts_preserve_native_string_grammar_and_precedence(): void {
  const rows = [
    ["--artifacts", "a.json"], ["--artifacts=a.json"], ["-artifacts", "a.json"],
    ["-artifacts=a.json"], ["--artifacts", "a.json", "--artifacts", "b.json"],
    ["--artifacts=a.json", "-artifacts", "b.json"], ["--artifacts", ""],
    ["--artifacts="], ["-artifacts="], ["--artifacts", "-literal.json"],
  ];
  const failures: unknown[] = [];
  for (const row of rows) {
    try { Arguments.dump(row); assert.deepEqual(Arguments.dumpVector(row, "automatic.json"), ["dump", ...row]); }
    catch (error) { failures.push(error); }
  }
  try { assert.deepEqual(Arguments.dumpVector([], "automatic.json"), ["dump", "--artifacts", "automatic.json"]); } catch (error) { failures.push(error); }
  try { assert.throws(() => Arguments.dump(["--artifacts"])); assert.throws(() => Arguments.dump(["--unknown"])); } catch (error) { failures.push(error); }
  if (failures.length) throw new AggregateError(failures, "Artifact argument matrix failed");
}
