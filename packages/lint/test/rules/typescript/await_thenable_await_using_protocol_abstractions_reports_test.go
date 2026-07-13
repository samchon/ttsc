package linthost

import (
  "strings"
  "testing"
)

// TestAwaitThenableAwaitUsingProtocolAbstractionsReports verifies the async-
// dispose lookup does not over-accept type abstractions that resolve to the
// sync-only protocol.
//
// One-property-away twins of the abstraction-allows scenario: the same
// alias / inheritance / intersection / generic-constraint shapes, but built
// on a `[Symbol.dispose]`-only resource. A lookup that treated "reached
// through an abstraction" as "async disposable" — or that keyed on the
// presence of ANY dispose protocol — would stay silent on all four.
//
//  1. Seed a project with `await using` over aliased, inherited,
//     intersected, and constraint-typed SYNC-only disposables.
//  2. Prove the fixture type-checks without a lint plugin entry.
//  3. Run `check` with typescript/await-thenable enabled as error.
//  4. Assert exactly four findings on the four declaration lines.
func TestAwaitThenableAwaitUsingProtocolAbstractionsReports(t *testing.T) {
  root := seedAwaitUsingLintProject(t, `export {};
interface SyncResource {
  [Symbol.dispose](): void;
}
type ResourceAlias = SyncResource;
interface NamedResource extends SyncResource {
  name: string;
}
declare const aliased: ResourceAlias;
declare const inherited: NamedResource;
declare const intersected: { name: string } & SyncResource;
async function main(): Promise<void> {
  await using fromAlias = aliased;
  await using fromInterface = inherited;
  await using fromIntersection = intersected;
  JSON.stringify([fromAlias, fromInterface, fromIntersection]);
}
async function openConstrained<T extends SyncResource>(factory: () => T): Promise<void> {
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
  if code != 2 || stdout != "" {
    t.Fatalf("await-using sync abstraction run mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  if got := strings.Count(stderr, "[typescript/await-thenable]"); got != 4 {
    t.Fatalf("expected 4 await-thenable findings, got %d:\n%s", got, stderr)
  }
  for _, anchor := range []string{"main.ts:13:", "main.ts:14:", "main.ts:15:", "main.ts:19:"} {
    if !diagnosticOutputContains(stderr, anchor) {
      t.Fatalf("missing finding at %s:\n%s", anchor, stderr)
    }
  }
}
