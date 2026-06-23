package graph

import (
  "path/filepath"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestValueCallEdgesCoverMethodsAndConstructors verifies that the value-call walk
// reaches what the checker resolves but the first cut dropped: a method-to-method
// call lands on the callee's method node, and a `new T()` lands on T's class node,
// both attributed to the calling method.
//
// Before method nodes existed, a callee that resolved to a method symbol was
// dropped (no node to point at) and a `new` expression was never visited, so a
// class whose logic lived in method bodies showed almost no outgoing edges. This
// pins that gap closed — the load-bearing reason a model could trust the graph
// for an architecture question instead of re-reading the source.
//
//  1. Compile a fixture where Controller.handle calls Service.run (via a parameter
//     and a constructed value) and constructs a Service.
//  2. Build the graph.
//  3. Assert handle -> Service.run (value-call, deduped) and handle -> Service
//     (the new-expression constructor edge) both exist.
func TestValueCallEdgesCoverMethodsAndConstructors(t *testing.T) {
  root := t.TempDir()
  writeFile(t, filepath.Join(root, "tsconfig.json"), fixtureTSConfig)
  writeFile(t, filepath.Join(root, "src", "main.ts"), `export class Service {
  run(): void {}
}
export class Controller {
  handle(s: Service): void {
    s.run();
    const made = new Service();
    made.run();
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

  handle := nodeID(path, "Controller.handle", NodeMethod)
  run := nodeID(path, "Service.run", NodeMethod)
  service := nodeID(path, "Service", NodeClass)

  // The callee method node both endpoints need must exist as a real node.
  if _, ok := graph.Nodes[run]; !ok {
    t.Fatalf("Build did not record the method node Service.run; have %v", nodeIDSet(graph))
  }
  // Method-to-method: handle calls Service.run (from s.run() and made.run(),
  // deduped to a single edge) — the call the first cut dropped.
  if !hasEdge(graph, handle, run, EdgeValueCall) {
    t.Fatalf("missing value-call edge Controller.handle -> Service.run; edges: %v", graph.Edges)
  }
  // Constructor: `new Service()` is a value-call from handle to the class node.
  if !hasEdge(graph, handle, service, EdgeValueCall) {
    t.Fatalf("missing value-call edge Controller.handle -> Service (new); edges: %v", graph.Edges)
  }
}
