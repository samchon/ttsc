package linthost

import (
  "strings"
  "testing"
)

// TestAwaitThenableAwaitUsingAsyncDisposableAllows verifies the `await using`
// arm of typescript/await-thenable stays silent on every valid shape from the
// upstream regression suite.
//
// The negative twins of the sync-disposable positive: an object literal with
// a real `[Symbol.asyncDispose]` method, an `any` initializer
// (typescript-eslint's explicit escape hatch), a plain `using` declaration
// over a sync disposable (no `await`, so the arm must not engage), and the
// `for (await using x of ...)` binding form whose declarators carry no
// initializer (upstream skips them). A regression that blanket-bans
// `await using` or keys on the statement instead of each initializer
// surfaces here.
//
//  1. Seed a project containing all four valid resource-management shapes.
//  2. Run `check` with typescript/await-thenable enabled as error.
//  3. Assert a clean exit with no await-thenable finding.
func TestAwaitThenableAwaitUsingAsyncDisposableAllows(t *testing.T) {
  root := seedLintProject(t, `export {};
declare global {
  interface SymbolConstructor {
    readonly dispose: unique symbol;
    readonly asyncDispose: unique symbol;
  }
}
interface AsyncResource {
  [Symbol.asyncDispose](): Promise<void>;
}
declare function listResources(): AsyncResource[];
async function main(): Promise<void> {
  await using asyncResource = {
    async [Symbol.asyncDispose](): Promise<void> {},
  };
  await using fromAny = 3 as any;
  using syncResource = {
    [Symbol.dispose](): void {},
  };
  for (await using iterated of listResources()) {
    JSON.stringify(iterated);
  }
  JSON.stringify([asyncResource, fromAny, syncResource]);
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
  if code != 0 || stdout != "" || strings.Contains(stderr, "[typescript/await-thenable]") {
    t.Fatalf("valid resource management was reported: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
}
