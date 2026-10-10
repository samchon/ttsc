package graph

import (
  "path/filepath"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestValueCallEdgesAttributeFunctionAssignmentsToMembers verifies function
// assignments to resolved members are walked as that member's implementation.
//
// This fixture assigns an arrow to an existing method from install. It observes
// the member-to-helper call and an ordered, positive implementation span in that
// file. Function expressions, alternate assignment forms, exact RHS bounds, and
// runtime installation effects are not authenticated by this one example.
//
//  1. Compile a fixture where `inst.run = () => helper()` assigns a typed class
//     method implementation.
//  2. Build the graph.
//  3. Assert the `Service.run` method has a value-call edge to `helper`.
//
// @evidence contracts/testing.md#behavioral-verification Verifies function assignments to resolved members are walked as that member's implementation.
// @evidence contracts/testing.md#independent-expectations The expectations are literal: after inst.run = () => helper(), a value-call edge must run from the Service.run method node to helper, and the Service.run node must carry an implementation span in the same file with a positive start and an end after it.
// @evidence contracts/testing.md#distinguishing-cases Compile a fixture where `inst.run = () => helper()` assigns a typed class method implementation; Build the graph; Assert the `Service.run` method has a value-call edge to `helper`.
// @evidence contracts/testing.md#execution-ownership Owns temporary native config/source files and a directly loaded library Program, closes it, and restores an empty linked-plugin manifest. Build and member-call/span observations run in this process using its actual filename and shared nodeID encoder. No independent identity oracle, product CLI, installation, or emitted assignment evaluation runs.
func TestValueCallEdgesAttributeFunctionAssignmentsToMembers(t *testing.T) {
  t.Setenv(driver.LinkedPluginsEnv, "")
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

  run := nodeID(path.AsString(), "Service.run", NodeMethod)
  helper := nodeID(path.AsString(), "helper", NodeFunction)

  if !hasEdge(graph, run, helper, EdgeValueCall) {
    t.Fatalf("missing value-call edge Service.run -> helper (assigned implementation); edges: %v", graph.Edges)
  }
  if graph.Nodes[run].ImplementationFile != path.AsString() ||
    graph.Nodes[run].ImplementationPos <= 0 ||
    graph.Nodes[run].ImplementationEnd <= graph.Nodes[run].ImplementationPos {
    t.Fatalf("Service.run missing assigned implementation span: %+v", graph.Nodes[run])
  }
}
