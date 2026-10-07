package graph

import (
  "path/filepath"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestValueCallEdgesResolveAcrossFilesAndDedupe verifies that a runtime call is
// recorded as a single value-call edge to the callee's real declaration, even
// when the authored caller contains two call sites. The count distinguishes
// missing and duplicate selected edges, but does not authenticate exclusive
// checker acquisition, every call site, retained evidence span, all graph pairs,
// runtime invocation, or downstream impact ranking.
//
//  1. Compile a fixture where caller() calls helper() (declared in another file)
//     twice.
//  2. Build the graph.
//  3. Assert exactly one caller -> helper value-call edge.
//
// @evidence contracts/testing.md#behavioral-verification Requires exactly one selected caller-to-helper value-call triple for two authored cross-file call sites. This distinguishes absent or duplicate triples, not exclusive acquisition, each site's independent traversal, retained source evidence, every graph pair, or downstream impact-query behavior.
// @evidence contracts/testing.md#independent-expectations The explicit input facts and supported graph/command contract establish exactly one caller -> helper value-call edge.
// @evidence contracts/testing.md#distinguishing-cases Compile a fixture where caller() calls helper() (declared in another file) twice; Build the graph; Assert exactly one caller -> helper value-call edge.
// @evidence contracts/testing.md#execution-ownership Owns temporary native config and two source files and a directly loaded library Program, closes it, and restores an empty linked-plugin manifest. Build and the literal triple count run in this process using its actual filenames and shared nodeID encoder. No independent identity oracle, product CLI, installation, emitted caller evaluation, or downstream impact query runs.
func TestValueCallEdgesResolveAcrossFilesAndDedupe(t *testing.T) {
  t.Setenv(driver.LinkedPluginsEnv, "")
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
