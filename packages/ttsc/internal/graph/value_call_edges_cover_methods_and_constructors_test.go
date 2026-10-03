package graph

import (
  "path/filepath"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestValueCallEdgesCoverMethodsAndConstructors verifies that the value-call walk
// records the selected authored relationships: a method-to-method
// call lands on the callee's method node, and a `new T()` lands on T's class node,
// both attributed to the calling method.
//
// Both run calls share endpoints, so presence cannot authenticate each call or
// deduplication. The new-expression triple does not assert its origin or wire
// kind. No runtime call, construction, or architecture-query consumer executes.
//
//  1. Compile a fixture where Controller.handle calls Service.run (via a parameter
//     and a constructed value) and constructs a Service.
//  2. Build the graph.
//  3. Assert handle -> Service.run (value-call presence) and handle -> Service
//     (the new-expression constructor edge) both exist.
//
// @evidence contracts/testing.md#behavioral-verification Requires the Service.run node and two selected handle value-call triples, to that method and to Service. Exact counts, each of the two run call sites, source spans, new origin, and wire instantiates kind are not asserted.
// @evidence contracts/testing.md#independent-expectations The expectations are literal over Controller.handle: the Service.run method node must exist, a value-call edge must run from Controller.handle to Service.run (reached through s.run() and made.run()), and a value-call edge must run from Controller.handle to the Service class node (new Service()). The test checks edge presence only, not that the two run() calls collapse to one edge.
// @evidence contracts/testing.md#distinguishing-cases The method call and construction have different authored target kinds, while the parameter and constructed-value run calls share one expected triple. Presence distinguishes missing method/class relationships but does not authenticate deduplication.
// @evidence contracts/testing.md#execution-ownership Owns temporary native config/source files and a directly loaded library Program, closes it, and restores an empty linked-plugin manifest. Build and literal edge observations run in this process using its actual filename and shared nodeID encoder. No independent identity oracle, product CLI, installation, emitted construction/calls, or architecture-query consumer runs.
func TestValueCallEdgesCoverMethodsAndConstructors(t *testing.T) {
  t.Setenv(driver.LinkedPluginsEnv, "")
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
  // Method-to-method presence; both authored calls share this triple.
  if !hasEdge(graph, handle, run, EdgeValueCall) {
    t.Fatalf("missing value-call edge Controller.handle -> Service.run; edges: %v", graph.Edges)
  }
  // Constructor: `new Service()` is a value-call from handle to the class node.
  if !hasEdge(graph, handle, service, EdgeValueCall) {
    t.Fatalf("missing value-call edge Controller.handle -> Service (new); edges: %v", graph.Edges)
  }
}
