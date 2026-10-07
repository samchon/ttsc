package graph

import (
  "path/filepath"
  "slices"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLiteralsResolveThroughAliasIndirection verifies that a union assembled out
// of other unions reports the literal values of the three authored aliases.
// One- and two-hop forms include inherited members; re-listing a requires one
// occurrence. This does not authenticate the acquisition algorithm, deeper
// alias handling or its cost.
//
//  1. Compile a fixture whose aliases build on each other, one of them
//     re-listing a member an aliased union already has.
//  2. Build the graph.
//  3. Assert each alias reports the full set it admits, deduplicated.
//
// @evidence contracts/testing.md#behavioral-verification Build must report exact ordered literal arrays for Wide, Wider and Duplicated, retaining inherited values across the tested one/two-hop aliases and one a in the duplicate form. Other alias structures and resolution work are not asserted.
// @evidence contracts/testing.md#independent-expectations The expectations are literal: Wide (Narrow | 'd') must report a, b, c, d; Wider (Wide | 'e') must report a through e; and Duplicated (Narrow | 'a') must report a, b, c with a once, all in source-quoted form.
// @evidence contracts/testing.md#distinguishing-cases Compile a fixture whose aliases build on each other, one of them re-listing a member an aliased union already has; Build the graph; Assert each alias reports the full set it admits, deduplicated.
// @evidence contracts/testing.md#execution-ownership This Go source-unit writes a native project, constructs/closes its driver Program in-process and directly calls Build and existing-node literalsOf. Actual filename/shared ID formatting select the aliases; a restored empty linked-plugin manifest excludes ambient hooks. No emit, installed consumer or product process runs.
func TestLiteralsResolveThroughAliasIndirection(t *testing.T) {
  t.Setenv(driver.LinkedPluginsEnv, "")
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
  // Two authored hops; this result check does not measure resolution cost.
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
