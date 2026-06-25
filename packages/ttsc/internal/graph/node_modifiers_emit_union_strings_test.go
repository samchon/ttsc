package graph

import (
  "path/filepath"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestNodeModifiersEmitUnionStrings verifies that the dump records a declaration's
// syntactic modifiers as wire strings drawn only from the TtscGraphNodeModifier
// union, mapping the combined modifier flags of a class, a static/readonly
// property, an accessibility-qualified async method, and an exported const onto
// their union members.
//
// The TypeScript loader runs `typia.assert<ITtscGraphDump>` over this dump, so a
// modifier string outside the union would reject the whole graph. The assertion
// pins both the exact strings emitted and the negative twin — a member with no
// modifier must carry none — so an over-broad flag mapping cannot slip through.
//
//  1. Compile a fixture with `export abstract class`, a `static readonly`
//     property, a `private async` method, a plain method, and `export const enum`
//     (the `const` keyword that is a modifier, unlike a `const` variable).
//  2. Build and marshal the dump.
//  3. Assert each node's modifiers are exactly the expected union strings, the
//     plain method has none, and every emitted string is a union member.
func TestNodeModifiersEmitUnionStrings(t *testing.T) {
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
  dump := NewDump(g, root, "tsconfig.json", nil, SourceTexts(prog))

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

  // Every emitted modifier is a member of the TtscGraphNodeModifier union, since
  // an unknown string would reject the dump under typia.assert.
  union := map[string]bool{
    "export": true, "default": true, "declare": true, "abstract": true,
    "static": true, "readonly": true, "async": true, "const": true,
    "public": true, "private": true, "protected": true, "optional": true,
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
