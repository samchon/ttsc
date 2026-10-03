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
 * @evidence contracts/testing.md#behavioral-verification TtscGraphLauncherArguments.dump must accept, and dumpVector must echo, each of ten artifact-flag argument lists (separate, equals, one- and two-dash, repeated, empty and dash-leading values); dumpVector([]) must add the automatic path, and dump must throw for a bare --artifacts and for --unknown.
 * @evidence contracts/testing.md#independent-expectations Each expected vector is the literal row prefixed with "dump", written by the test rather than computed by the launcher; the absence of the "automatic.json" literal from every explicit-artifact vector shows the automatic path is suppressed.
 * @evidence contracts/testing.md#distinguishing-cases Rows differ by flag spelling and value shape (empty string, equals-empty, a value beginning with a dash that a generic value option would reject) and are contrasted with the no-flag list and with the two throwing inputs. The repeated-flag rows assert only that both occurrences are forwarded; which occurrence wins is not asserted, and only the artifact option is exercised, not cwd or tsconfig.
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
