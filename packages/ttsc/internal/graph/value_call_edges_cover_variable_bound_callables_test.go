package graph

import (
  "path/filepath"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestValueCallEdgesCoverVariableBoundCallables verifies that a call made inside a
// top-level variable-bound function (a `const fn = () => …`) is an edge from that
// variable node. The first cut never walked a variable initializer, so an
// arrow-const that called a function produced no edge — a common modern-TS shape
// the graph silently missed.
//
//  1. Compile a fixture where `const handler = () => { helper(); }`.
//  2. Build the graph.
//  3. Assert a handler -> helper value-call edge exists.
func TestValueCallEdgesCoverVariableBoundCallables(t *testing.T) {
  root := t.TempDir()
  writeFile(t, filepath.Join(root, "tsconfig.json"), fixtureTSConfig)
  writeFile(t, filepath.Join(root, "src", "main.ts"), `export function helper(): void {}
export const handler = (): void => {
  helper();
};
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

  handler := nodeID(path, "handler", NodeVariable)
  helper := nodeID(path, "helper", NodeFunction)

  if !hasEdge(graph, handler, helper, EdgeValueCall) {
    t.Fatalf("missing value-call edge handler -> helper (variable-bound callable body); edges: %v", graph.Edges)
  }
}
