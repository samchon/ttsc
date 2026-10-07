package graph

import (
  "path/filepath"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestValueCallEdgesSkipSelfAndUnresolved checks an absent self-call and absent
// dynamic-host value calls alongside an ordinary cross-call. All four authored
// function nodes must exist; otherwise dropping the negative owners would pass.
// The flags and return values of private acquisition helpers are not observed.
//
// The positive caller->helper edge is the load-bearing twin: without it the test
// would also pass if callEdge recorded nothing at all, so it proves the two skips
// are specific to a self-call and an unresolved callee, not a blanket failure to
// emit value-call edges.
//
//  1. Compile a fixture with `rec()` returning `rec()`, `caller()` calling a
//     separate `helper()`, and `dynamic(host: any)` calling `host.run()`.
//  2. Build the graph.
//  3. Assert no rec->rec edge and no edge out of dynamic, but a caller->helper
//     value-call edge.
//
// @evidence contracts/testing.md#behavioral-verification Requires all four resident function nodes, rejects rec-to-rec value-call and all dynamic-owner value-calls, and requires caller-to-helper. The cross-call rejects blanket suppression; resident-owner premises reject erased negative declarations. No direct Resolve-nil premise, all callee forms, or runtime recursion is asserted.
// @evidence contracts/testing.md#independent-expectations The explicit input facts and supported graph/command contract establish no rec->rec edge and no edge out of dynamic, but a caller->helper value-call edge.
// @evidence contracts/testing.md#distinguishing-cases Compile a fixture with `rec()` returning `rec()`, `caller()` calling a separate `helper()`, and `dynamic(host: any)` calling `host.run()`; Build the graph; Assert no rec->rec edge and no edge out of dynamic, but a caller->helper value-call edge.
// @evidence contracts/testing.md#execution-ownership Owns temporary native config/source files and a directly loaded library Program, closes it, and restores an empty linked-plugin manifest. Build and literal node/edge observations run in this process using its actual filename and shared nodeID encoder. No independent identity oracle, product CLI, installation, or emitted recursive/dynamic invocation runs.
func TestValueCallEdgesSkipSelfAndUnresolved(t *testing.T) {
  t.Setenv(driver.LinkedPluginsEnv, "")
  root := t.TempDir()
  writeFile(t, filepath.Join(root, "tsconfig.json"), fixtureTSConfig)
  writeFile(t, filepath.Join(root, "src", "main.ts"), `export function rec(): unknown {
  return rec();
}
export function helper(): void {}
export function caller(): void {
  helper();
}
export function dynamic(host: any): void {
  host.run();
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

  rec := nodeID(path, "rec", NodeFunction)
  helper := nodeID(path, "helper", NodeFunction)
  caller := nodeID(path, "caller", NodeFunction)
  dynamic := nodeID(path, "dynamic", NodeFunction)

  for _, id := range []string{rec, helper, caller, dynamic} {
    if graph.Nodes[id] == nil {
      t.Fatalf("missing authored function node %s; nodes: %v", id, nodeIDSet(graph))
    }
  }

  // Self-call: callEdge skips `to == from`, so rec never points at itself.
  if hasEdge(graph, rec, rec, EdgeValueCall) {
    t.Fatalf("a self-call recorded a rec -> rec value-call edge; edges: %v", graph.Edges)
  }
  // Unresolved callee: `host.run()` binds to no declaration, so dynamic gains no
  // outgoing value-call edge.
  for _, edge := range graph.Edges {
    if edge.From == dynamic && edge.Kind == EdgeValueCall {
      t.Fatalf("an unresolved callee recorded a value-call edge out of dynamic: %+v", edge)
    }
  }
  // Positive twin: an ordinary cross-call is still recorded, proving the skips
  // above are specific and not a blanket suppression.
  if !hasEdge(graph, caller, helper, EdgeValueCall) {
    t.Fatalf("missing value-call edge caller -> helper; edges: %v", graph.Edges)
  }
}
