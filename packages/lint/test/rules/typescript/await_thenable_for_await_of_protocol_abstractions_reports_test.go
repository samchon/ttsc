package linthost

import (
  "strings"
  "testing"
)

// TestAwaitThenableForAwaitOfProtocolAbstractionsReports verifies the async-
// iterator lookup does not over-accept type abstractions that resolve to a
// sync-only protocol.
//
// One-property-away twins of the abstraction-allows scenario: the same
// alias / inheritance / intersection / generic-constraint shapes, but built
// on `Iterable` instead of `AsyncIterable`. A lookup that treated "reached
// through an abstraction" as "async iterable" — or that keyed on the
// presence of ANY iteration protocol — would stay silent here.
//
//  1. Seed a project iterating aliased, inherited, intersected, and
//     constraint-typed SYNC iterables with `for await`.
//  2. Run `check` with typescript/await-thenable enabled as error.
//  3. Assert exactly four findings on the four loop lines.
func TestAwaitThenableForAwaitOfProtocolAbstractionsReports(t *testing.T) {
  root := seedLintProject(t, `type NumberList = Iterable<number>;
interface NamedList extends Iterable<number> {
  name: string;
}
declare const aliased: NumberList;
declare const inherited: NamedList;
declare const intersected: { name: string } & Iterable<number>;
async function drain<T extends Iterable<number>>(source: T): Promise<void> {
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
  if code != 2 || stdout != "" {
    t.Fatalf("for-await-of sync abstraction run mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  if got := strings.Count(stderr, "[typescript/await-thenable]"); got != 4 {
    t.Fatalf("expected 4 await-thenable findings, got %d:\n%s", got, stderr)
  }
  for _, anchor := range []string{"main.ts:9:", "main.ts:14:", "main.ts:17:", "main.ts:20:"} {
    if !strings.Contains(stderr, anchor) {
      t.Fatalf("missing finding at %s:\n%s", anchor, stderr)
    }
  }
}
