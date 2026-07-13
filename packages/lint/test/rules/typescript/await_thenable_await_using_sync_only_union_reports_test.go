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
//  2. Run `check` with typescript/await-thenable enabled as error.
//  3. Assert exactly one finding on the declaration line.
func TestAwaitThenableAwaitUsingSyncOnlyUnionReports(t *testing.T) {
  root := seedLintProject(t, `export {};
declare global {
  interface SymbolConstructor {
    readonly dispose: unique symbol;
    readonly asyncDispose: unique symbol;
  }
}
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
  if !strings.Contains(stderr, "main.ts:17:") {
    t.Fatalf("finding not anchored on the declaration line:\n%s", stderr)
  }
}
