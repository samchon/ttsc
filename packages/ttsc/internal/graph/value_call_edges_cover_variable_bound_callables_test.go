package graph

import (
  "path/filepath"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestValueCallEdgesCoverVariableBoundCallables verifies that a call made inside a
// top-level variable-bound function (a `const fn = () => …`) is an edge from that
// variable node. This is one exported arrow initializer and one call-presence
// observation; other callable forms, spans, exact counts, and runtime handler
// effects are not exercised.
//
//  1. Compile a fixture where `const handler = () => { helper(); }`.
//  2. Build the graph.
//  3. Assert a handler -> helper value-call edge exists.
//
// @evidence contracts/testing.md#behavioral-verification Requires the authored handler-variable-to-helper-function value-call triple for one arrow initializer. It does not authenticate other callable forms, exact counts or spans, historical failures, or executed handler behavior.
// @evidence contracts/testing.md#independent-expectations The expectation is literal: for export const handler = () => { helper(); } a value-call edge must run from the handler variable node to the helper function node.
// @evidence contracts/testing.md#distinguishing-cases Compile a fixture where `const handler = () => { helper(); }`; Build the graph; Assert a handler -> helper value-call edge exists.
// @evidence contracts/testing.md#execution-ownership Owns temporary native config/source files and a directly loaded library Program, closes it, and restores an empty linked-plugin manifest. Build and the literal triple observation run in this process using its actual filename and shared nodeID encoder. No independent identity oracle, product CLI, installation, or emitted handler evaluation runs.
func TestValueCallEdgesCoverVariableBoundCallables(t *testing.T) {
  t.Setenv(driver.LinkedPluginsEnv, "")
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

  handler := nodeID(path.AsString(), "handler", NodeVariable)
  helper := nodeID(path.AsString(), "helper", NodeFunction)

  if !hasEdge(graph, handler, helper, EdgeValueCall) {
    t.Fatalf("missing value-call edge handler -> helper (variable-bound callable body); edges: %v", graph.Edges)
  }
}
