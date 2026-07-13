package linthost

import (
  "strings"
  "testing"
)

// TestAwaitThenableAwaitUsingMultiDeclaratorReportsOnlySyncResource verifies
// a multi-declarator `await using` statement reports per initializer, not per
// statement.
//
// Upstream iterates `node.declarations` and reports each offending
// declarator's init individually. A statement-level implementation would
// either flag the whole statement (also smearing the valid first resource)
// or stop after the first declarator and miss later offenders; asserting
// exactly one finding anchored at the second initializer pins both
// directions.
//
//  1. Seed a project with `await using ok = makeAsync(), bad = makeSync();`.
//  2. Prove the fixture type-checks without a lint plugin entry.
//  3. Run `check` with typescript/await-thenable enabled as error.
//  4. Assert exactly one finding, anchored at the second declarator's
//     initializer expression.
func TestAwaitThenableAwaitUsingMultiDeclaratorReportsOnlySyncResource(t *testing.T) {
  root := seedAwaitUsingLintProject(t, `export {};
interface AsyncResource {
  [Symbol.asyncDispose](): Promise<void>;
}
interface SyncResource {
  [Symbol.dispose](): void;
}
declare function makeAsync(): AsyncResource;
declare function makeSync(): SyncResource;
async function main(): Promise<void> {
  await using first = makeAsync(), second = makeSync();
  JSON.stringify([first, second]);
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
    t.Fatalf("multi-declarator run mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  if got := strings.Count(stderr, "[typescript/await-thenable]"); got != 1 {
    t.Fatalf("expected 1 await-thenable finding, got %d:\n%s", got, stderr)
  }
  if !diagnosticOutputContains(stderr, "main.ts:11:45") {
    t.Fatalf("finding not anchored at the sync declarator's initializer:\n%s", stderr)
  }
}
