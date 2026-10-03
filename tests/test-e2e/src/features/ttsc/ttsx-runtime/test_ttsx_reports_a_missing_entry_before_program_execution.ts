import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Public missing-entry errors stop before compiler or program preparation.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual public ttsx rejects an absent fixture entry with status 2 and stderr naming both the entry-not-found diagnostic and requested filename.
 * @evidence contracts/testing.md#independent-expectations An absent entry cannot be executed; the CLI contract reports a runner error with status 2 instead of invoking a compiler or returning successful process output.
 * @evidence contracts/testing.md#distinguishing-cases This case owns a provided-but-nonexistent entry. The actual parser unit owns missing lexical entry and terminal precedence; the installed CLI smoke owns help usage/headline and version prefix/compiler version assertions.
 * @evidence contracts/testing.md#execution-ownership This matching named E2E entry invokes one built public bootstrap against a fresh empty directory; no consumer installation or compiler build repeats here.
 * @evidence contracts/e2e.md#necessary-boundary Launcher filesystem validation must connect to the actual stderr and process-status channels; a direct parser result cannot establish that bootstrap error handling.
 * @evidence contracts/e2e.md#shared-execution Only the unique missing-file request remains. Help and version assertions run in the existing installed-consumer smoke using its existing version request and one help request instead of separate runtime hosts.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity An isolated empty fixture directory ensures the requested file is genuinely absent without relying on repository layout; synchronous spawn closes its process before TestProject releases the directory.
 * @evidence contracts/e2e.md#preserved-coverage Original status-2, entry-not-found and missing-entry.ts stderr assertions remain unchanged. Original zero-exit, help headline/usage, version prefix and parenthesized compiler-version assertions have executable ownership in installed-cli-smoke after commit 7d0438b6.
 */
export function test_ttsx_reports_a_missing_entry_before_program_execution() {
  const missingEntry = TestProject.spawn(
    TestProject.TTSX_BIN,
    ["missing-entry.ts"],
    {
      cwd: TestProject.tmpdir("ttsx-absent-entry-"),
    },
  );
  assert.equal(missingEntry.status, 2);
  assert.match(missingEntry.stderr, /ttsx: entry not found:/);
  assert.match(missingEntry.stderr, /missing-entry\.ts/);
}