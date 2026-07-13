package linthost

import (
  "strings"
  "testing"
)

// TestAwaitThenableAwaitUsingProtocolAbstractionsAllows verifies the async-
// dispose protocol lookup resolves through type abstractions instead of
// surface spelling.
//
// None of these initializers declares `[Symbol.asyncDispose]` directly: the
// member arrives through a type alias, an `extends` clause, an intersection
// constituent, and a generic constraint. A lookup keyed on declared type
// names (`AsyncDisposable`) or on direct members only would wrongly report all
// four; the checker-backed `GetPropertyOfType` path must keep them clean.
//
//  1. Seed a project with `await using` over aliased, inherited,
//     intersected, and constraint-typed async disposables.
//  2. Run `check` with typescript/await-thenable enabled as error.
//  3. Assert a clean exit with no await-thenable finding.
func TestAwaitThenableAwaitUsingProtocolAbstractionsAllows(t *testing.T) {
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
type ResourceAlias = AsyncResource;
interface NamedResource extends AsyncResource {
  name: string;
}
declare const aliased: ResourceAlias;
declare const inherited: NamedResource;
declare const intersected: { name: string } & AsyncResource;
async function main(): Promise<void> {
  await using fromAlias = aliased;
  await using fromInterface = inherited;
  await using fromIntersection = intersected;
  JSON.stringify([fromAlias, fromInterface, fromIntersection]);
}
async function openConstrained<T extends AsyncResource>(factory: () => T): Promise<void> {
  await using constrained = factory();
  JSON.stringify(constrained);
}
void main();
void openConstrained(() => aliased);
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
    t.Fatalf("abstracted async disposables were reported: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
}
