package graph

import (
  "path/filepath"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestHeritageEdgesCoverImplementsAndInterfaceExtends verifies that
// collectHeritage spans both heritage-bearing declaration kinds and both clause
// keywords: an interface `extends` and a class `implements` each yield a
// heritage edge to the same base, while a class that only mentions the base in a
// parameter type position yields a type-ref edge, never a heritage edge.
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
//     Unrelated->Base is a type-ref edge but not a heritage edge.
func TestHeritageEdgesCoverImplementsAndInterfaceExtends(t *testing.T) {
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
