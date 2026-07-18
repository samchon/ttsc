package graph

import (
  "path/filepath"
  "slices"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLiteralsDoNotDependOnDeclarationLineWrapping verifies that collectLiterals
// answers with the union's members whatever the declaration's layout: the same
// eight-member type written one member per line and written on one line both
// report all eight.
//
// This is the #732 regression. The value set used to be scraped out of the
// declaration's first four lines of source text and cut to six, so completeness
// was a function of line wrapping and of member count rather than of the type:
// the wrapped form reported the three members that fit in the snippet, and the
// flat form reported six of eight. Both cuts were silent. Eight members is the
// boundary that pins both at once — it is past the old six-member cap, so a
// reintroduced cap fails here on the flat twin instead of hiding behind a small
// fixture.
//
//  1. Compile a fixture with a wrapped union and a flat union of the same eight
//     string literals.
//  2. Build the graph.
//  3. Assert both nodes carry all eight values, in source form, and that the two
//     lists are identical.
func TestLiteralsDoNotDependOnDeclarationLineWrapping(t *testing.T) {
  root := t.TempDir()
  writeFile(t, filepath.Join(root, "tsconfig.json"), fixtureTSConfig)
  writeFile(t, filepath.Join(root, "src", "main.ts"), `export type Wrapped =
  | 'a' // a trailing comment the old snippet scrape also had to survive
  | 'b'
  | 'c'
  | 'd'
  | 'e'
  | 'f'
  | 'g'
  | 'h';

export type Flat = 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g' | 'h';
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

  want := []string{`"a"`, `"b"`, `"c"`, `"d"`, `"e"`, `"f"`, `"g"`, `"h"`}
  wrapped := literalsOf(t, graph, nodeID(path, "Wrapped", NodeTypeAlias))
  flat := literalsOf(t, graph, nodeID(path, "Flat", NodeTypeAlias))

  if !slices.Equal(wrapped, want) {
    t.Fatalf("wrapped union under-reported its members: got %v, want %v", wrapped, want)
  }
  if !slices.Equal(flat, want) {
    t.Fatalf("flat union under-reported its members: got %v, want %v", flat, want)
  }
  // The point of the fix stated directly: layout is not allowed to change the
  // answer for one and the same type.
  if !slices.Equal(wrapped, flat) {
    t.Fatalf("line wrapping changed the value set: wrapped %v, flat %v", wrapped, flat)
  }
}

// literalsOf returns the recorded value set of the node id names, failing the
// test when the graph holds no such node.
func literalsOf(t *testing.T, graph *Graph, id string) []string {
  t.Helper()
  node, ok := graph.Nodes[id]
  if !ok {
    t.Fatalf("graph has no node %q; nodes: %v", id, nodeIDSet(graph))
  }
  return node.Literals
}
