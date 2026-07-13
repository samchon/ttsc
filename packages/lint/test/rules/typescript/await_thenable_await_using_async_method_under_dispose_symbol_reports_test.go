package linthost

import (
  "strings"
  "testing"
)

// TestAwaitThenableAwaitUsingAsyncMethodUnderDisposeSymbolReports verifies an
// `async [Symbol.dispose]()` method does not pass for the async-dispose
// protocol.
//
// Upstream's sharpest invalid case: the resource DOES have an async method —
// but it hangs off the wrong well-known symbol. A capability check keyed on
// "has some async-looking member" or on method return types would wrongly
// accept it; only the resolved `[Symbol.asyncDispose]` property lookup
// rejects it. Pins the one-property-away boundary against the
// `async [Symbol.asyncDispose]()` allow case.
//
//  1. Seed a project declaring `await using` over an object whose only
//     member is `async [Symbol.dispose]()`.
//  2. Run `check` with typescript/await-thenable enabled as error.
//  3. Assert exactly one finding on the declaration line.
func TestAwaitThenableAwaitUsingAsyncMethodUnderDisposeSymbolReports(t *testing.T) {
  root := seedLintProject(t, `export {};
declare global {
  interface SymbolConstructor {
    readonly dispose: unique symbol;
    readonly asyncDispose: unique symbol;
  }
}
async function main(): Promise<void> {
  await using resource = {
    async [Symbol.dispose](): Promise<void> {},
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
    t.Fatalf("async-method-under-dispose run mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  if got := strings.Count(stderr, "[typescript/await-thenable]"); got != 1 {
    t.Fatalf("expected 1 await-thenable finding, got %d:\n%s", got, stderr)
  }
  if !diagnosticOutputContains(stderr, "main.ts:9:") {
    t.Fatalf("finding not anchored on the declaration line:\n%s", stderr)
  }
}
