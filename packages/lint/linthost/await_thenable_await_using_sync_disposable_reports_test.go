package linthost

import (
  "strings"
  "testing"
)

// TestAwaitThenableAwaitUsingSyncDisposableReports verifies the `await using`
// arm of typescript/await-thenable fires when the resource only implements
// the sync `[Symbol.dispose]` protocol.
//
// A resource with only Symbol.dispose lacks the async-dispose protocol this
// rule requires for await using. The standard ESNext.Disposable library supplies
// the protocol types and symbols. A separate no-plugin check establishes the
// compiler prerequisite, while the rule-enabled check pins one finding to the
// initializer expression at line 3, column 26.
//
//  1. Seed a project declaring `await using` over a `[Symbol.dispose]`-only
//     object literal.
//  2. Prove the fixture type-checks without a lint plugin entry.
//  3. Run `check` with typescript/await-thenable enabled as error.
//  4. Assert exactly one finding anchored at the initializer with the
//     upstream message text.
//
// @evidence contracts/testing.md#behavioral-verification Await-using a sync-only disposable must report at its initializer.
// @evidence contracts/testing.md#independent-expectations The authored sync-only symbol independently requires one rule-labelled error, the literal message and initializer anchor main.ts:3:26, code 2 and empty stdout. Label counting rejects extras; the rendered-main.ts helper checks line 3 and error severity, without certifying unrelated diagnostics.
// @evidence contracts/testing.md#distinguishing-cases Original upstream message and line3 column26 remain required; AsyncDisposableAllows provides the async protocol counterpart.
// @evidence contracts/testing.md#execution-ownership TestAwaitThenableAwaitUsingSyncDisposableReports executes the in-process check command with a real Program/Checker; the original separate no-plugin compiler-prerequisite check is retained before rule execution in the shared Go unit process. Fixture configuration is input; no child compiler, native build or installed consumer runs.
func TestAwaitThenableAwaitUsingSyncDisposableReports(t *testing.T) {
  root := seedAwaitUsingLintProject(t, `export {};
async function main(): Promise<void> {
  await using resource = {
    [Symbol.dispose](): void {},
  };
  JSON.stringify(resource);
}
void main();
`)
  assertAwaitUsingProjectTypeChecks(t, root)
  seedLintRules(t, root, map[string]string{"typescript/await-thenable": "error"})

  code, stdout, stderr := captureCommandOutput(t, func() int {
    return run([]string{
      "check",
      "--cwd", root,
      "--plugins-json", lintManifest(t),
    })
  })
  if code != 2 || stdout != "" {
    t.Fatalf("await-using sync disposable run mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  if got := strings.Count(stderr, "[typescript/await-thenable]"); got != 1 {
    t.Fatalf("expected 1 await-thenable finding, got %d:\n%s", got, stderr)
  }
  if !strings.Contains(stderr, "Unexpected `await using` of a value that is not async disposable.") {
    t.Fatalf("missing upstream await-using message:\n%s", stderr)
  }
  if !diagnosticOutputContains(stderr, "main.ts:3:26") {
    t.Fatalf("finding not anchored at the initializer expression:\n%s", stderr)
  }
  assertTypedRuleRenderedErrors(t, "typescript/await-thenable", stderr, 3)
}
