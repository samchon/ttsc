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
//  2. Prove the fixture type-checks without a lint plugin entry.
//  3. Run `check` with typescript/await-thenable enabled as error.
//  4. Assert a clean exit with no await-thenable finding.
//
// @evidence contracts/testing.md#behavioral-verification Async-dispose must be recognized through aliases, inherited interfaces, intersections and generic constraints.
// @evidence contracts/testing.md#independent-expectations The authored async-protocol alias, inherited interface, intersection and constrained factory independently require code 0, empty stdout and no rule-labelled stderr after the separate no-plugin compiler check. The rendered-main.ts helper also requires zero matches, without certifying unrelated diagnostics.
// @evidence contracts/testing.md#distinguishing-cases Four async abstraction shapes remain clean; ProtocolAbstractionsReports repeats those shapes with sync-only dispose.
// @evidence contracts/testing.md#execution-ownership TestAwaitThenableAwaitUsingProtocolAbstractionsAllows executes the in-process check command with a real Program/Checker; the original separate no-plugin compiler-prerequisite check is retained before rule execution in the shared Go unit process. Fixture configuration is input; no child compiler, native build or installed consumer runs.
func TestAwaitThenableAwaitUsingProtocolAbstractionsAllows(t *testing.T) {
  root := seedAwaitUsingLintProject(t, `export {};
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
    t.Fatalf("abstracted async disposables were reported: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  assertTypedRuleRenderedErrors(t, "typescript/await-thenable", stderr)
}
