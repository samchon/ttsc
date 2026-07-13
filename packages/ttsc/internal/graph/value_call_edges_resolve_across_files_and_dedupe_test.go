package graph

import (
  "path/filepath"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestValueCallEdgesResolveAcrossFilesAndDedupe verifies that a runtime call is
// recorded as a single value-call edge to the callee's real declaration, even
// when the caller invokes it from several sites. Cross-file resolution proves the
// edge rides the checker; the dedup keeps the call graph one-edge-per-pair so an
// impact query is not skewed by how many times a function is called.
//
//  1. Compile a fixture where caller() calls helper() (declared in another file)
//     twice.
//  2. Build the graph.
//  3. Assert exactly one caller -> helper value-call edge.
func TestValueCallEdgesResolveAcrossFilesAndDedupe(t *testing.T) {
  root := t.TempDir()
  writeFile(t, filepath.Join(root, "tsconfig.json"), fixtureTSConfig)
  writeFile(t, filepath.Join(root, "src", "util.ts"), `export function helper(): number {
  return 1;
}
`)
  writeFile(t, filepath.Join(root, "src", "main.ts"), `import { helper } from "./util";
export function caller(): number {
  return helper() + helper();
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
  caller := nodeID(sourceFile(t, prog, "main.ts").FileName(), "caller", NodeFunction)
  helper := nodeID(sourceFile(t, prog, "util.ts").FileName(), "helper", NodeFunction)

  count := 0
  for _, edge := range graph.Edges {
    if edge.From == caller && edge.To == helper && edge.Kind == EdgeValueCall {
      count++
    }
  }
  if count != 1 {
    t.Fatalf("expected exactly one caller -> helper value-call edge, got %d; edges: %v", count, graph.Edges)
  }
}
