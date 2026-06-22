package graph

import (
  "path/filepath"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestValueCallEdgesSkipSelfAndUnresolved verifies that callEdge drops the two
// edges it is documented to skip while still recording an ordinary cross-call:
// a self-call (`rec` calling `rec`) yields no edge because `to == from`, and a
// call whose callee the checker cannot bind to a declaration (a method on an
// `any`-typed value) yields no edge because Resolve returns nil.
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
func TestValueCallEdgesSkipSelfAndUnresolved(t *testing.T) {
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
