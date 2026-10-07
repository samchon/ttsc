package graph

import (
  "path/filepath"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestValueCallEdgesRecordConstructVersusCallOrigin checks that selected
// internal value-call edges report "call" for a method call and "new" for a
// class construction. This test does not invoke the dump's wire-kind mapping.
//
// The two targets also have different node kinds, so these selected origins do
// not independently reject origin inference from target kind. Exact counts,
// all matching edges, emitted execution, and MCP consumption are unobserved.
//
//  1. Compile a fixture where Controller.handle both calls Service.run and
//     constructs `new Service()`.
//  2. Build the graph.
//  3. Assert the handle->Service.run edge has Origin "call" and the
//     handle->Service edge has Origin "new".
//
// @evidence contracts/testing.md#behavioral-verification Requires literal call/new origins on the first matching internal value-call triples. The target kinds differ too, so exclusive syntax acquisition is not authenticated; wire calls/instantiates mapping and exact edge counts are not asserted.
// @evidence contracts/testing.md#independent-expectations The explicit input facts and supported graph/command contract establish "call", "new"; the handle->Service.run edge has Origin "call" and the handle->Service edge has Origin "new".
// @evidence contracts/testing.md#distinguishing-cases Compile a fixture where Controller.handle both calls Service.run and constructs `new Service()`; Build the graph; Assert the handle->Service.run edge has Origin "call" and the handle->Service edge has Origin "new".
// @evidence contracts/testing.md#execution-ownership Owns temporary native config/source files and a directly loaded library Program, closes it, and restores an empty linked-plugin manifest. Build and first-match edgeOrigin observations run in this process using its actual filename and shared nodeID encoder. No independent identity oracle, dump serialization, product CLI, installation, emitted invocation, or MCP consumer runs.
func TestValueCallEdgesRecordConstructVersusCallOrigin(t *testing.T) {
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
    void made;
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

  if got := edgeOrigin(graph, handle, run, EdgeValueCall); got != "call" {
    t.Fatalf("Controller.handle -> Service.run: want Origin \"call\", got %q; edges: %v", got, graph.Edges)
  }
  if got := edgeOrigin(graph, handle, service, EdgeValueCall); got != "new" {
    t.Fatalf("Controller.handle -> Service (new): want Origin \"new\", got %q; edges: %v", got, graph.Edges)
  }
}

// edgeOrigin returns the Origin of the first from->to edge of kind, or the
// sentinel "<missing>" when no such edge exists, so a test distinguishes a wrong
// origin from an absent edge.
func edgeOrigin(graph *Graph, from, to string, kind EdgeKind) string {
  for _, edge := range graph.Edges {
    if edge.From == from && edge.To == to && edge.Kind == kind {
      return edge.Origin
    }
  }
  return "<missing>"
}
