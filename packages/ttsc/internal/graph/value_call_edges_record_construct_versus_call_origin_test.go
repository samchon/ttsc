package graph

import (
  "path/filepath"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestValueCallEdgesRecordConstructVersusCallOrigin verifies that a value-call
// edge carries the syntactic Origin the dump splits into the schema's `calls`
// versus `instantiates` kinds: a plain call records "call", a `new T()` records
// "new".
//
// The internal model keeps one EdgeValueCall kind so the existing MCP stays
// untouched; the finer distinction the redesigned graph schema requires
// (`new Foo()` is an instantiation, not a call) rides on Edge.Origin. Without it
// the dump could not recover a constructor from an invocation after the fact, so
// this pins the discriminator at its source.
//
//  1. Compile a fixture where Controller.handle both calls Service.run and
//     constructs `new Service()`.
//  2. Build the graph.
//  3. Assert the handle->Service.run edge has Origin "call" and the
//     handle->Service edge has Origin "new".
func TestValueCallEdgesRecordConstructVersusCallOrigin(t *testing.T) {
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
