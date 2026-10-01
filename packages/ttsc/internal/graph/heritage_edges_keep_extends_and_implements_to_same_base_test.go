package graph

import (
  "path/filepath"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestHeritageEdgesKeepExtendsAndImplementsToSameBase verifies that a class which
// both extends and implements the same base records two distinct heritage edges
// — `extends` and `implements` — rather than collapsing to one. The edge dedup
// keys on the emitted wire kind, so two relationships to one target that mean
// different things both survive; a dedup on the internal edge kind alone would
// drop the second clause and the dump would claim only inheritance or only
// conformance, never both.
//
//  1. Compile a fixture with `class Derived extends Base implements Base`.
//  2. Build the graph.
//  3. Assert both an `extends` and an `implements` heritage edge Derived -> Base,
//     and that they map to the distinct wire kinds the dump emits.
//
// @evidence contracts/testing.md#behavioral-verification Verifies that a class which both extends and implements the same base records two distinct heritage edges — `extends` and `implements` — rather than collapsing to one. The edge dedup keys on the emitted wire kind, so two relationships to one target that mean different things both survive; a dedup on the internal edge kind alone would drop the second clause and the dump would claim only inheritance or only conformance, never both.
// @evidence contracts/testing.md#independent-expectations The explicit input facts and supported graph/command contract establish both an `extends` and an `implements` heritage edge Derived -> Base, and that they map to the distinct wire kinds the dump emits.
// @evidence contracts/testing.md#distinguishing-cases Compile a fixture with `class Derived extends Base implements Base`; Build the graph; Assert both an `extends` and an `implements` heritage edge Derived -> Base, and that they map to the distinct wire kinds the dump emits.
// @evidence contracts/testing.md#execution-ownership TestHeritageEdgesKeepExtendsAndImplementsToSameBase is a Go source-unit entry. Build, nodeID execute directly over the authored source or explicit input facts. The owning operations stay in this test process, without installing a consumer or building or starting a native product binary.
func TestHeritageEdgesKeepExtendsAndImplementsToSameBase(t *testing.T) {
  root := t.TempDir()
  writeFile(t, filepath.Join(root, "tsconfig.json"), fixtureTSConfig)
  writeFile(t, filepath.Join(root, "src", "main.ts"), `export class Base {
  value(): number {
    return 1;
  }
}
export class Derived extends Base implements Base {}
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

  derived := nodeID(path, "Derived", NodeClass)
  base := nodeID(path, "Base", NodeClass)

  wireKinds := map[string]bool{}
  for _, edge := range graph.Edges {
    if edge.From != derived || edge.To != base || edge.Kind != EdgeHeritage {
      continue
    }
    wireKinds[dumpEdgeKind(edge)] = true
  }
  if !wireKinds["extends"] || !wireKinds["implements"] {
    t.Fatalf(
      "Derived -> Base heritage edges = %v; want both extends and implements; edges: %v",
      wireKinds, graph.Edges,
    )
  }
}
