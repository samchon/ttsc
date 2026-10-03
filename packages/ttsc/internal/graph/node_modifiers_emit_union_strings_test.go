package graph

import (
  "path/filepath"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestNodeModifiersEmitUnionStrings verifies that the dump records a declaration's
// selected syntactic modifiers in NewDump's returned records: class,
// static/readonly property, private async method and exported const enum.
// A plain method provides a negative counterpart; an authored eleven-name
// allowlist checks only strings present in this fixture, not a live TS union.
//
//  1. Compile a fixture with `export abstract class`, a `static readonly`
//     property, a `private async` method, a plain method, and `export const enum`
//     (the `const` keyword that is a modifier, unlike a `const` variable).
//  2. Build and construct the dump records without JSON serialization.
//  3. Assert each node's modifiers are exactly the expected union strings, the
//     plain method has none, and every emitted string is a union member.
//
// @evidence contracts/testing.md#behavioral-verification Actual Build/NewDump records must hold the four exact ordered modifier arrays, no modifiers on Service.plain, and only names in the authored allowlist across this fixture. No JSON encoding, TS validator or unexercised modifier branch is authenticated.
// @evidence contracts/testing.md#independent-expectations The expectations are literal wire strings in the stable emitted order: Service {export, abstract}, Service.config {static, readonly}, Service.run {async, private}, Mode {export, const}, and none for Service.plain. The final check compares every emitted modifier with an eleven-name list written into the test as a copy of the TtscGraphNodeModifier union; that copy is not read from the TypeScript definition, so drift in the TypeScript union would not be noticed here.
// @evidence contracts/testing.md#distinguishing-cases Class, property, method and const-enum modifier combinations have independent exact arrays; the plain method must remain empty. The allowlist is a guard on emitted names, not positive coverage of all eleven allowed names.
// @evidence contracts/testing.md#execution-ownership This Go source-unit writes a native project, constructs/closes its driver Program in-process and directly calls Build, NewDump and SourceTexts. Local ordered-slice and failure-ID helpers inspect returned records; a restored empty linked-plugin manifest excludes ambient hooks. No serialization, installed consumer, validator or product process runs.
func TestNodeModifiersEmitUnionStrings(t *testing.T) {
  t.Setenv(driver.LinkedPluginsEnv, "")
  root := t.TempDir()
  writeFile(t, filepath.Join(root, "tsconfig.json"), fixtureTSConfig)
  writeFile(t, filepath.Join(root, "src", "main.ts"), `export abstract class Service {
  static readonly config: number = 1;
  private async run(): Promise<void> {}
  plain(): void {}
}
export const enum Mode {
  On,
}
`)

  prog, diags, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{})
  if err != nil {
    t.Fatal(err)
  }
  if len(diags) != 0 {
    t.Fatalf("unexpected diagnostics: %v", diags)
  }
  defer func() { _ = prog.Close() }()

  g := Build(prog)
  dump, err := NewDump(g, root, "tsconfig.json", nil, SourceTexts(prog), DumpOrigin{})
  if err != nil {
    t.Fatal(err)
  }

  byID := make(map[string]DumpNode, len(dump.Nodes))
  for _, n := range dump.Nodes {
    byID[n.ID] = n
  }

  want := map[string][]string{
    "src/main.ts#Service:class":           {"export", "abstract"},
    "src/main.ts#Service.config:variable": {"static", "readonly"},
    "src/main.ts#Service.run:method":      {"async", "private"},
    "src/main.ts#Mode:enum":               {"export", "const"},
  }
  for id, expected := range want {
    node, ok := byID[id]
    if !ok {
      t.Fatalf("missing node %q; have %v", id, dumpNodeIDs(dump))
    }
    if !equalStrings(node.Modifiers, expected) {
      t.Fatalf("node %q modifiers = %v, want %v", id, node.Modifiers, expected)
    }
  }

  // Negative twin: a member with no modifier keyword emits no modifiers.
  plain, ok := byID["src/main.ts#Service.plain:method"]
  if !ok {
    t.Fatalf("missing plain method node; have %v", dumpNodeIDs(dump))
  }
  if len(plain.Modifiers) != 0 {
    t.Fatalf("plain method modifiers = %v, want none", plain.Modifiers)
  }

  // Every returned modifier in this fixture must belong to this authored list;
  // no TypeScript definition or consumer validator is consulted here.
  union := map[string]bool{
    "export": true, "default": true, "declare": true, "abstract": true,
    "static": true, "readonly": true, "async": true, "const": true,
    "public": true, "private": true, "protected": true,
  }
  for _, n := range dump.Nodes {
    for _, m := range n.Modifiers {
      if !union[m] {
        t.Fatalf("node %q emitted non-union modifier %q", n.ID, m)
      }
    }
  }
}

// equalStrings reports whether two string slices have the same elements in order.
func equalStrings(a, b []string) bool {
  if len(a) != len(b) {
    return false
  }
  for i := range a {
    if a[i] != b[i] {
      return false
    }
  }
  return true
}

// dumpNodeIDs returns a dump's node ids for failure messages.
func dumpNodeIDs(d Dump) []string {
  ids := make([]string, 0, len(d.Nodes))
  for _, n := range d.Nodes {
    ids = append(ids, n.ID)
  }
  return ids
}
