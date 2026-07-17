package graph

import (
  "path/filepath"
  "slices"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLiteralsCoverEnumMembersTheGraphHasNoNodesFor verifies that an enum
// reports its member values, string-valued, numeric, and implicitly numbered
// alike, however the declaration is laid out.
//
// An enum needed this more than a union did (#732). Its members are not nodes —
// the build pass records member nodes for classes and interfaces only — so
// nothing else in a details result carries them, and the old source-text scrape
// stopped at the line holding `{`, which is the first line of every enum written
// the ordinary way. A multi-line enum therefore reported no members at all,
// through `literals` or otherwise, and only a single-line one answered. The
// implicit fixture pins that the values come from the checker rather than the
// text: nothing in `Implicit`'s source spells out 0 and 1.
//
//  1. Compile a fixture with a multi-line string enum, a single-line one, and an
//     enum whose members are implicitly numbered.
//  2. Build the graph.
//  3. Assert each reports its resolved member values, and that the enum still
//     has no member nodes so `literals` is genuinely the only carrier.
func TestLiteralsCoverEnumMembersTheGraphHasNoNodesFor(t *testing.T) {
  root := t.TempDir()
  writeFile(t, filepath.Join(root, "tsconfig.json"), fixtureTSConfig)
  writeFile(t, filepath.Join(root, "src", "main.ts"), `export enum Wrapped {
  A = 'a',
  B = 'b',
  C = 'c',
}

export enum Flat { A = 'a', B = 'b', C = 'c' }

export enum Implicit {
  First,
  Second,
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

  graph := Build(prog)
  path := sourceFile(t, prog, "main.ts").FileName()

  // The declaration whose members the old scrape could never reach.
  wrapped := literalsOf(t, graph, nodeID(path, "Wrapped", NodeEnum))
  if want := []string{`"a"`, `"b"`, `"c"`}; !slices.Equal(wrapped, want) {
    t.Fatalf("multi-line enum under-reported its members: got %v, want %v", wrapped, want)
  }
  // Layout is not the fact; the single-line twin must agree exactly.
  flat := literalsOf(t, graph, nodeID(path, "Flat", NodeEnum))
  if !slices.Equal(flat, wrapped) {
    t.Fatalf("enum layout changed the value set: wrapped %v, flat %v", wrapped, flat)
  }
  // Implicitly numbered members: the values exist only in the checker, never in
  // the source text, so a scrape of any kind cannot produce this list.
  implicit := literalsOf(t, graph, nodeID(path, "Implicit", NodeEnum))
  if want := []string{"0", "1"}; !slices.Equal(implicit, want) {
    t.Fatalf("implicitly numbered enum did not report its resolved values: got %v, want %v", implicit, want)
  }
  // The premise: no member node exists to carry these instead, so dropping
  // `literals` for an enum would take its members out of the graph entirely.
  if node, ok := graph.Nodes[nodeID(path, "Wrapped.A", NodeMethod)]; ok {
    t.Fatalf("enum member unexpectedly modeled as a node (%v); literals may no longer be the only carrier", node.ID)
  }
}
