import { FixtureFiles } from "../../../internal/FixtureFiles";
import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies `--require` with no value still fails loudly.
 *
 * Declaring `--require` repeatable moved preload collection from a hand-written
 * rescue scan into the schema engine. The scan silently ignored a valueless
 * `-r`; the engine rejects it. This pins the boundary so the move cannot
 * quietly relax the flag's contract: a value flag missing its value is an
 * error, not an empty preload list.
 *
 * The flag has to be the last token and sit before any entry: a `-r` written
 * after the entry belongs to the program's own argv, which is the neighbouring
 * case `test_ttsx_does_not_preload_a_require_written_after_the_entry` pins.
 *
 * 1. Create a project with a runnable entry.
 * 2. Run ttsx with a trailing `-r` that has no value and no entry after it.
 * 3. Assert a non-zero exit and the "requires a value" message.
 *
 * @evidence contracts/testing.md#behavioral-verification Public ttsx rejects a trailing valueless require and renders the parser error with a failed process exit.
 * @evidence contracts/testing.md#independent-expectations A require flag needs a following module value; the literal requires-a-value diagnostic and nonzero status follow that public CLI contract.
 * @evidence contracts/testing.md#distinguishing-cases A missing pre-entry value rejects; ordered valued preloads and post-entry require forwarding have the shared preload host and parser unit as their positive and adjacent owners.
 * @evidence contracts/testing.md#execution-ownership This named E2E entry invokes the built public launcher; the parser unit separately owns short/long malformed tokens without process startup.
 * @evidence contracts/e2e.md#necessary-boundary The CLI bootstrap must invoke the parser and convert its thrown error to stderr and nonzero exit; a direct parser throw cannot prove that error channel.
 * @evidence contracts/e2e.md#shared-execution One minimal invalid-value process covers the shared launcher error-rendering assembly; watch/build spelling and predicate decisions run directly in the parser unit.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity An isolated project is input only and no compiler can start before this parse failure; synchronous spawn completes before fixture cleanup and retains no child handle.
 * @evidence contracts/e2e.md#preserved-coverage The original nonzero-exit and -r-requires-a-value assertion remain exactly here; all removed early watch/build decisions retain their original diagnostics in the actual launcher-parser unit.
 */
export function test_ttsx_rejects_a_require_without_a_value() {
  const root = TestProject.createProject(FixtureFiles.read("ttsc/ttsx_rejects_a_require_without_a_value/inputs-1"));

  const result = TestProject.spawn(
    TestProject.TTSX_BIN,
    ["--cwd", root, "-r"],
    { cwd: root },
  );
  assert.notEqual(result.status, 0, `${result.stdout}${result.stderr}`);
  assert.match(result.stderr, /-r requires a value/);
}