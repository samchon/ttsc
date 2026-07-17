package graph

import (
  "path/filepath"
  "slices"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLiteralsResolveThroughAliasIndirection verifies that a union assembled out
// of other unions reports every member it admits, including the ones no token of
// its own declaration names.
//
// This is the half of #732 that was not truncation but a wrong answer of the
// right shape. Reading `type Wide = Narrow | 'd'` off the source text finds one
// quoted token and reports `'d'`, a complete-looking three-member type reduced
// to one, with nothing marking the loss. Only the checker has followed Narrow.
// The nested case (`Wider = Wide | 'e'`) pins that the resolution is not one hop
// deep, and the checker also flattens and dedups, so `Duplicated` must report
// `'a'` once rather than twice.
//
//  1. Compile a fixture whose aliases build on each other, one of them
//     re-listing a member an aliased union already has.
//  2. Build the graph.
//  3. Assert each alias reports the full set it admits, deduplicated.
func TestLiteralsResolveThroughAliasIndirection(t *testing.T) {
  root := t.TempDir()
  writeFile(t, filepath.Join(root, "tsconfig.json"), fixtureTSConfig)
  writeFile(t, filepath.Join(root, "src", "main.ts"), `export type Narrow = 'a' | 'b' | 'c';
export type Wide = Narrow | 'd';
export type Wider = Wide | 'e';
export type Duplicated = Narrow | 'a';
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

  // One hop: the three members reaching Wide through Narrow are Wide's too.
  wide := literalsOf(t, graph, nodeID(path, "Wide", NodeTypeAlias))
  if want := []string{`"a"`, `"b"`, `"c"`, `"d"`}; !slices.Equal(wide, want) {
    t.Fatalf("alias indirection lost members: got %v, want %v", wide, want)
  }
  // Two hops: resolution is the type's, so depth costs nothing.
  wider := literalsOf(t, graph, nodeID(path, "Wider", NodeTypeAlias))
  if want := []string{`"a"`, `"b"`, `"c"`, `"d"`, `"e"`}; !slices.Equal(wider, want) {
    t.Fatalf("nested alias indirection lost members: got %v, want %v", wider, want)
  }
  // A member named twice is one member; the checker has already deduped, so the
  // list must not report `"a"` once per mention.
  duplicated := literalsOf(t, graph, nodeID(path, "Duplicated", NodeTypeAlias))
  if want := []string{`"a"`, `"b"`, `"c"`}; !slices.Equal(duplicated, want) {
    t.Fatalf("a member named twice was reported twice: got %v, want %v", duplicated, want)
  }
}
