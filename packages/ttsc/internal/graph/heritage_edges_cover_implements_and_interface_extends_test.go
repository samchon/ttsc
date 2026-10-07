package graph

import (
  "path/filepath"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestHeritageEdgesCoverImplementsAndInterfaceExtends verifies that
// collectHeritage spans both heritage-bearing declaration kinds and both clause
// keywords: an interface `extends` and a class `implements` each yield a
// heritage edge to the same base. The authored Unrelated.greet parameter yields
// a method-to-Base type reference, without either tested heritage edge from
// Unrelated or Unrelated.greet.
//
// The negative twin pins the boundary collectHeritage must hold: heritage is an
// `extends`/`implements` relationship, so a base reached only through a method
// parameter type (`greet(b: Base)`) must not leak into the heritage set; a path
// heuristic that treated any mention of Base as inheritance would over-match
// here.
//
//  1. Compile a fixture with `interface Derived extends Base`,
//     `class Impl implements Base`, and `class Unrelated` whose only Base
//     reference is the parameter type of a method.
//  2. Build the graph.
//  3. Assert heritage edges Derived->Base and Impl->Base exist, and that
//     Unrelated.greet->Base is a type-ref edge, while both Unrelated and its
//     method have no heritage edge to Base.
//
// @evidence contracts/testing.md#behavioral-verification The authored interface Derived and class Impl must each have a heritage edge to Base. Unrelated.greet must have a type-ref edge to Base, while neither that method nor Unrelated has the tested heritage edge. Wire keyword projection, edge spans and other declaration forms are not asserted.
// @evidence contracts/testing.md#independent-expectations The expectations are literal over Base, Derived, Impl and Unrelated: heritage edges Derived to Base and Impl to Base must exist, no heritage edge may leave Unrelated or Unrelated.greet to Base, and a type-ref edge must run from Unrelated.greet to Base.
// @evidence contracts/testing.md#distinguishing-cases Interface extends and class implements clauses provide positive heritage counterparts; a method parameter referencing the same Base must produce a method-owned type-ref instead of either tested heritage edge. Shared target identity keeps the syntactic relation as the distinguishing property.
// @evidence contracts/testing.md#execution-ownership This Go source-unit writes a native project, constructs/closes a driver Program in-process and directly calls Build. Actual Program filenames and shared nodeID formatting select literal-name endpoints, not an independent ID-grammar oracle. A restored empty linked-plugin manifest excludes ambient hooks; no dump serialization, installed consumer or product process runs.
func TestHeritageEdgesCoverImplementsAndInterfaceExtends(t *testing.T) {
  t.Setenv(driver.LinkedPluginsEnv, "")
  root := t.TempDir()
  writeFile(t, filepath.Join(root, "tsconfig.json"), fixtureTSConfig)
  writeFile(t, filepath.Join(root, "src", "main.ts"), `export interface Base {}
export interface Derived extends Base {}
export class Impl implements Base {}
export class Unrelated {
  greet(b: Base): void {
    void b;
  }
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

  base := nodeID(path, "Base", NodeInterface)
  derived := nodeID(path, "Derived", NodeInterface)
  impl := nodeID(path, "Impl", NodeClass)
  unrelated := nodeID(path, "Unrelated", NodeClass)
  greet := nodeID(path, "Unrelated.greet", NodeMethod)

  // Interface `extends`: Derived inherits Base.
  if !hasEdge(graph, derived, base, EdgeHeritage) {
    t.Fatalf("missing heritage edge Derived -> Base (interface extends); edges: %v", graph.Edges)
  }
  // Class `implements`: Impl declares Base as a heritage base.
  if !hasEdge(graph, impl, base, EdgeHeritage) {
    t.Fatalf("missing heritage edge Impl -> Base (class implements); edges: %v", graph.Edges)
  }
  // Negative twin: the base named only in a method parameter type is a type-ref
  // dependency of that method (Unrelated.greet -> Base), never a heritage edge —
  // not from the class and not from the method.
  if hasEdge(graph, unrelated, base, EdgeHeritage) || hasEdge(graph, greet, base, EdgeHeritage) {
    t.Fatalf("a parameter-type reference to Base was misclassified as a heritage edge; edges: %v", graph.Edges)
  }
  if !hasEdge(graph, greet, base, EdgeTypeRef) {
    t.Fatalf("missing type-ref edge Unrelated.greet -> Base (parameter type); edges: %v", graph.Edges)
  }
}
