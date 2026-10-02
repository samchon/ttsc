package linthost

import (
  "strings"
  "testing"
)

// TestAwaitThenableForAwaitOfSyncOnlyUnionReports verifies a union whose
// constituents are ALL sync-only still reports under `for await...of`.
//
// The negative twin of the `AsyncIterable<string> | Iterable<string>` allow
// case: the union walk accepts when ANY constituent implements
// `[Symbol.asyncIterator]`, so a union of two sync iterables must not slip
// through merely because it is a union. The authored Iterable and array
// constituents are synchronous; JavaScript iteration legality does not
// determine this rule's async-protocol policy.
//
//  1. Seed a project iterating `Iterable<string> | string[]` with
//     `for await`.
//  2. Run `check` with typescript/await-thenable enabled as error.
//  3. Assert exactly one finding on the loop line.
//
// @evidence contracts/testing.md#behavioral-verification A union consisting only of synchronous iterable forms must report.
// @evidence contracts/testing.md#independent-expectations The authored Iterable<string> | string[] source independently requires one rule-labelled error on line 3, code 2 and empty stdout. Label counting rejects extras, and the rendered-main.ts helper checks line 3 and error severity; exact columns, message text and unrelated diagnostics are outside these assertions.
// @evidence contracts/testing.md#distinguishing-cases The sync Iterable|string-array union contrasts with AsyncIterableAllows mixed async/sync union.
// @evidence contracts/testing.md#execution-ownership TestAwaitThenableForAwaitOfSyncOnlyUnionReports invokes the in-process check command with a real Program/Checker in the shared Go unit population; original source/configuration and all assertions remain, with no child compiler, installed consumer or native artifact build.
func TestAwaitThenableForAwaitOfSyncOnlyUnionReports(t *testing.T) {
  root := seedLintProject(t, `declare const syncOnly: Iterable<string> | string[];
async function main(): Promise<void> {
  for await (const item of syncOnly) {
    JSON.stringify(item);
  }
}
void main();
`)
  seedLintRules(t, root, map[string]string{"typescript/await-thenable": "error"})

  code, stdout, stderr := captureCommandOutput(t, func() int {
    return run([]string{
      "check",
      "--cwd", root,
      "--plugins-json", lintManifest(t),
    })
  })
  if code != 2 || stdout != "" {
    t.Fatalf("sync-only union run mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  if got := strings.Count(stderr, "[typescript/await-thenable]"); got != 1 {
    t.Fatalf("expected 1 await-thenable finding, got %d:\n%s", got, stderr)
  }
  if !diagnosticOutputContains(stderr, "main.ts:3:") {
    t.Fatalf("finding not anchored on the loop line:\n%s", stderr)
  }
  assertTypedRuleRenderedErrors(t, "typescript/await-thenable", stderr, 3)
}
