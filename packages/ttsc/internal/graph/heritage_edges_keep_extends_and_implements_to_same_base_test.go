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
// @evidence contracts/testing.md#behavioral-verification Build's selected Derived-to-Base heritage edges, passed through actual dumpEdgeKind, must include both extends and implements. This catches collapsing the two clause meanings, but does not assert an exact edge count or serialize a dump.
// @evidence contracts/testing.md#independent-expectations The expectation is literal: for class Derived extends Base implements Base the heritage edges from Derived to Base, mapped with dumpEdgeKind, must yield both the wire kinds extends and implements. The expected wire names come from the schema vocabulary, but the mapping function is the one under test.
// @evidence contracts/testing.md#distinguishing-cases Compile a fixture with `class Derived extends Base implements Base`; Build the graph; Assert both an `extends` and an `implements` heritage edge Derived -> Base, and that they map to the distinct wire kinds the dump emits.
// @evidence contracts/testing.md#execution-ownership This Go source-unit writes a native project, constructs/closes its driver Program in-process and directly calls Build and dumpEdgeKind. Actual Program filename and shared nodeID formatting select literal Derived/Base endpoints; a restored empty linked-plugin manifest excludes ambient hooks. No JSON dump, consumer installation or product process runs.
func TestHeritageEdgesKeepExtendsAndImplementsToSameBase(t *testing.T) {
  t.Setenv(driver.LinkedPluginsEnv, "")
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
