package graph

import (
  "path/filepath"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestEdgesCoverClassLevelReferences verifies that the references living on a
// class declaration itself — not in a member — are attributed to the class
// node. The method-node split walks members one at a time, so without an
// explicit class-level pass these edges are silently dropped:
//
//   - a heritage type argument `extends Base<Payload>` -> type-ref to Payload
//   - a type parameter constraint `<T extends Constraint>` -> type-ref to Constraint
//
// These are exactly the relationships generic-heavy codebases are built from, so
// a top-level-only-then-per-member walk that forgot them would blind the graph
// to generic-base edges.
//
// A decorator's own factory call (`@Injectable()`) is deliberately NOT a
// value-call edge: the decoration is a fact on the node's decorators, and a
// calls edge to the decorator function would make ubiquitous decorators the
// busiest nodes in the graph. The test pins both halves of that contract.
func TestEdgesCoverClassLevelReferences(t *testing.T) {
  root := t.TempDir()
  writeFile(t, filepath.Join(root, "tsconfig.json"), `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "strict": true,
    "experimentalDecorators": true,
    "rootDir": "src",
    "outDir": "dist"
  },
  "files": ["src/main.ts"]
}
`)
  writeFile(t, filepath.Join(root, "src", "main.ts"), `export function Injectable() {
  return function (_target: Function): void {};
}
export class Base<T> {
  value!: T;
}
export interface Payload {}
export interface Constraint {}

@Injectable()
export class Service<T extends Constraint> extends Base<Payload> {}
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

  service := nodeID(path, "Service", NodeClass)
  injectable := nodeID(path, "Injectable", NodeFunction)
  base := nodeID(path, "Base", NodeClass)
  payload := nodeID(path, "Payload", NodeInterface)
  constraint := nodeID(path, "Constraint", NodeInterface)

  // The decorator factory call is a fact, not an edge: no value-call to
  // Injectable, but a recorded decorator on the Service node.
  if hasEdge(graph, service, injectable, EdgeValueCall) {
    t.Errorf("decorator factory call leaked a value-call edge Service -> Injectable")
  }
  if !hasDecorator(graph, service, "Injectable") {
    t.Errorf("missing decorator fact @Injectable on Service")
  }
  if !hasEdge(graph, service, payload, EdgeTypeRef) {
    t.Errorf("missing type-ref edge Service -> Payload (heritage type argument)")
  }
  if !hasEdge(graph, service, constraint, EdgeTypeRef) {
    t.Errorf("missing type-ref edge Service -> Constraint (type parameter constraint)")
  }
  // The base expression itself stays a heritage edge, unaffected by the
  // class-level type-argument walk.
  if !hasEdge(graph, service, base, EdgeHeritage) {
    t.Errorf("missing heritage edge Service -> Base")
  }
  if t.Failed() {
    t.Logf("edges: %v", graph.Edges)
  }
}
