package linthost

import (
  "strings"
  "testing"
)

// TestAwaitThenableAwaitUsingSyncDisposableReports verifies the `await using`
// arm of typescript/await-thenable fires when the resource only implements
// the sync `[Symbol.dispose]` protocol.
//
// The rule historically visited only KindAwaitExpression, so `await using` of
// a sync-only disposable never reported (#413). JavaScript permits the
// fallback (the runtime wraps the sync disposer), which is exactly why only
// the type-level `[Symbol.asyncDispose]` protocol check can catch the pointless
// `await`. The disposable symbols come from a `declare global`
// augmentation, the standard shape for projects without the
// `ESNext.Disposable` lib, so the well-known-symbol resolution is exercised
// through the merged SymbolConstructor rather than lib-provided members. The
// expected column pins the diagnostic to the initializer expression.
//
//  1. Seed a project declaring `await using` over a `[Symbol.dispose]`-only
//     object literal.
//  2. Run `check` with typescript/await-thenable enabled as error.
//  3. Assert exactly one finding anchored at the initializer with the
//     upstream message text.
func TestAwaitThenableAwaitUsingSyncDisposableReports(t *testing.T) {
  root := seedLintProject(t, `export {};
declare global {
  interface SymbolConstructor {
    readonly dispose: unique symbol;
    readonly asyncDispose: unique symbol;
  }
}
async function main(): Promise<void> {
  await using resource = {
    [Symbol.dispose](): void {},
  };
  JSON.stringify(resource);
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
    t.Fatalf("await-using sync disposable run mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  if got := strings.Count(stderr, "[typescript/await-thenable]"); got != 1 {
    t.Fatalf("expected 1 await-thenable finding, got %d:\n%s", got, stderr)
  }
  if !strings.Contains(stderr, "Unexpected `await using` of a value that is not async disposable.") {
    t.Fatalf("missing upstream await-using message:\n%s", stderr)
  }
  if !diagnosticOutputContains(stderr, "main.ts:9:26") {
    t.Fatalf("finding not anchored at the initializer expression:\n%s", stderr)
  }
}
