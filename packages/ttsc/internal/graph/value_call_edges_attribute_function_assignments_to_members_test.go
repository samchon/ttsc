package graph

import (
  "path/filepath"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestValueCallEdgesAttributeFunctionAssignmentsToMembers verifies function
// assignments to resolved members are walked as that member's implementation.
//
// Libraries sometimes attach methods by assigning an arrow/function expression
// to a typed property instead of declaring a class method body. The class-level
// walk sees the assignment, but graph flow still needs the assigned member node
// to own calls made inside the RHS function.
//
//  1. Compile a fixture where `inst.run = () => helper()` assigns a typed class
//     method implementation.
//  2. Build the graph.
//  3. Assert the `Service.run` method has a value-call edge to `helper`.
func TestValueCallEdgesAttributeFunctionAssignmentsToMembers(t *testing.T) {
  root := t.TempDir()
  writeFile(t, filepath.Join(root, "tsconfig.json"), fixtureTSConfig)
  writeFile(t, filepath.Join(root, "src", "main.ts"), `export function helper(): void {}
export class Service {
  run(): void {}
}
export function install(inst: Service): void {
  inst.run = (): void => {
    helper();
  };
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

  run := nodeID(path, "Service.run", NodeMethod)
  helper := nodeID(path, "helper", NodeFunction)

  if !hasEdge(graph, run, helper, EdgeValueCall) {
    t.Fatalf("missing value-call edge Service.run -> helper (assigned implementation); edges: %v", graph.Edges)
  }
  if graph.Nodes[run].ImplementationFile != path ||
    graph.Nodes[run].ImplementationPos <= 0 ||
    graph.Nodes[run].ImplementationEnd <= graph.Nodes[run].ImplementationPos {
    t.Fatalf("Service.run missing assigned implementation span: %+v", graph.Nodes[run])
  }
}
