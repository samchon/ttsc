package linthost

import (
  "strings"
  "testing"
)

// TestAwaitThenableAwaitUsingUnionWithAsyncDisposableAllows verifies a union
// initializer stays clean when at least one constituent is async disposable.
//
// Mirrors upstream's `Disposable | AsyncDisposable` valid case. A union type
// only surfaces properties present on EVERY constituent, so a naive
// `GetPropertyOfType(union, asyncDispose)` would return nil here and
// wrongly report; the rule must walk union constituents individually the way
// typescript-eslint's `unionConstituents(...).some(...)` does.
//
//  1. Seed a project declaring `await using` over a
//     `SyncResource | AsyncResource` value.
//  2. Prove the fixture type-checks without a lint plugin entry.
//  3. Run `check` with typescript/await-thenable enabled as error.
//  4. Assert a clean exit with no await-thenable finding.
func TestAwaitThenableAwaitUsingUnionWithAsyncDisposableAllows(t *testing.T) {
  root := seedAwaitUsingLintProject(t, `export {};
interface SyncResource {
  [Symbol.dispose](): void;
}
interface AsyncResource {
  [Symbol.asyncDispose](): Promise<void>;
}
declare const either: SyncResource | AsyncResource;
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
  if code != 0 || stdout != "" || strings.Contains(stderr, "[typescript/await-thenable]") {
    t.Fatalf("maybe-async disposable union was reported: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
}
