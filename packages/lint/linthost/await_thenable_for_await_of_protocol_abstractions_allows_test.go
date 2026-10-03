package linthost

import (
  "strings"
  "testing"
)

// TestAwaitThenableForAwaitOfProtocolAbstractionsAllows verifies the async-
// iterator protocol lookup resolves through type abstractions instead of
// surface spelling.
//
// The `[Symbol.asyncIterator]` member is not declared on any of these types
// directly: it arrives through a type alias, an `extends` clause, an
// intersection constituent, and a generic constraint. A lookup that matched
// declared type names or direct members only would wrongly report all four;
// the checker-backed `GetPropertyOfType` path must keep them clean.
//
//  1. Seed a project iterating aliased, inherited, intersected, and
//     constraint-typed async iterables with `for await`.
//  2. Run `check` with typescript/await-thenable enabled as error.
//  3. Assert a clean exit with no await-thenable finding.
//
// @evidence contracts/testing.md#behavioral-verification Async-iterable protocol detection must traverse aliases, inheritance, intersections and constraints.
// @evidence contracts/testing.md#independent-expectations The authored AsyncIterable alias, inherited interface, intersection and generic constraint independently require code 0, empty stdout and no rule-labelled stderr. The rendered-main.ts helper also requires zero matches, without certifying unrelated diagnostics.
// @evidence contracts/testing.md#distinguishing-cases The four async abstraction shapes remain clean; ProtocolAbstractionsReports changes them to sync Iterable.
// @evidence contracts/testing.md#execution-ownership TestAwaitThenableForAwaitOfProtocolAbstractionsAllows executes the in-process check command with a real Program/Checker in the shared Go unit process. Fixture configuration is input; no child compiler, native build or installed consumer runs.
func TestAwaitThenableForAwaitOfProtocolAbstractionsAllows(t *testing.T) {
  root := seedLintProject(t, `type NumberStream = AsyncIterable<number>;
interface NamedFeed extends AsyncIterable<number> {
  name: string;
}
declare const aliased: NumberStream;
declare const inherited: NamedFeed;
declare const intersected: { name: string } & AsyncIterable<number>;
async function drain<T extends AsyncIterable<number>>(source: T): Promise<void> {
  for await (const constrained of source) {
    JSON.stringify(constrained);
  }
}
async function main(): Promise<void> {
  for await (const fromAlias of aliased) {
    JSON.stringify(fromAlias);
  }
  for await (const fromInterface of inherited) {
    JSON.stringify(fromInterface);
  }
  for await (const fromIntersection of intersected) {
    JSON.stringify(fromIntersection);
  }
}
void drain(aliased);
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
    t.Fatalf("abstracted async iterables were reported: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  assertTypedRuleRenderedErrors(t, "typescript/await-thenable", stderr)
}
