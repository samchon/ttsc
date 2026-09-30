package linthost

import (
  "strings"
  "testing"
)

// TestAwaitThenableAwaitUsingSyncOnlyUnionReports verifies a union whose
// constituents are ALL sync-only disposables still reports under
// `await using`.
//
// The negative twin of the `SyncResource | AsyncResource` allow case: the
// union walk accepts when ANY constituent implements
// `[Symbol.asyncDispose]`, so a union of two sync disposables must not slip
// through simply for being a union. Both constituents dispose fine under a
// plain `using`, which is why only the type-level protocol check catches the
// pointless `await`.
//
//  1. Seed a project declaring `await using` over a
//     `FileHandle | SocketHandle` value where both sides are sync-only.
//  2. Prove the fixture type-checks without a lint plugin entry.
//  3. Run `check` with typescript/await-thenable enabled as error.
//  4. Assert exactly one finding on the declaration line.
// @evidence contracts/testing.md#behavioral-verification A union with only sync disposables must report.
// @evidence contracts/testing.md#independent-expectations The authored source and original complete assertions fix exact rule/error rendered lines 11 with code 2 and empty stdout; added per-rule diagnostic parsing rejects wrong severity or unrelated diagnostic anchors.
// @evidence contracts/testing.md#distinguishing-cases UnionWithAsyncDisposableAllows differs by retaining an async-dispose constituent; this policy is about possible async protocol, not a runtime completion guarantee.
// @evidence contracts/testing.md#execution-ownership TestAwaitThenableAwaitUsingSyncOnlyUnionReports executes the in-process check command with a real Program/Checker; the original separate no-plugin compiler-prerequisite check is retained before rule execution in the shared Go unit process. Fixture configuration is input; no child compiler, native build or installed consumer runs.
func TestAwaitThenableAwaitUsingSyncOnlyUnionReports(t *testing.T) {
  root := seedAwaitUsingLintProject(t, `export {};
interface FileHandle {
  [Symbol.dispose](): void;
}
interface SocketHandle {
  [Symbol.dispose](): void;
  close(): void;
}
declare const either: FileHandle | SocketHandle;
async function main(): Promise<void> {
  await using resource = either;
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
    t.Fatalf("sync-only disposable union run mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  if got := strings.Count(stderr, "[typescript/await-thenable]"); got != 1 {
    t.Fatalf("expected 1 await-thenable finding, got %d:\n%s", got, stderr)
  }
  if !diagnosticOutputContains(stderr, "main.ts:11:") {
    t.Fatalf("finding not anchored on the declaration line:\n%s", stderr)
  }
  assertTypedRuleRenderedErrors(t, "typescript/await-thenable", stderr, 11)
}
