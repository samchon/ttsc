package graph

import (
  "path/filepath"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestEnumInitializerCallsAreEdges pins that a value-call inside a (non-const)
// enum member initializer is recorded as an edge from the enum node in the
// authored E { A = base() } fixture. Other initializer forms and emitted enum
// execution are not tested here.
//
// 1. Load enum E whose A initializer calls base.
// 2. Build the enum and initializer relations.
// 3. Require the E node and its value-call edge to base.
//
// @evidence contracts/testing.md#behavioral-verification Require the E node and its value-call edge to base.
// @evidence contracts/testing.md#independent-expectations The expectation is literal: for export enum E { A = base() } the graph must hold the E enum node and a value-call edge from E to the base function; dropping the initializer walk fails the edge check.
// @evidence contracts/testing.md#distinguishing-cases Load enum E whose A initializer calls base. Build the enum and initializer relations. Require the E node and its value-call edge to base.
// @evidence contracts/testing.md#execution-ownership This Go source-unit writes a native project, constructs/closes a driver Program in-process and calls Build. Actual Program filename and shared nodeID formatting select the literal E/base endpoints, not an independent ID grammar. A restored empty linked-plugin manifest excludes ambient hooks; no emit, installed consumer or product process runs.
func TestEnumInitializerCallsAreEdges(t *testing.T) {
  t.Setenv(driver.LinkedPluginsEnv, "")
  root := t.TempDir()
  writeFile(t, filepath.Join(root, "tsconfig.json"), `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "strict": true,
    "rootDir": "src",
    "outDir": "dist"
  },
  "files": ["src/main.ts"]
}
`)
  writeFile(t, filepath.Join(root, "src", "main.ts"), `export function base(): number {
  return 1;
}

export enum E {
  A = base(),
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
  enumID := nodeID(path, "E", NodeEnum)
  baseID := nodeID(path, "base", NodeFunction)

  if _, ok := graph.Nodes[enumID]; !ok {
    t.Fatalf("enum E was not recorded as a node")
  }
  found := false
  for _, edge := range graph.Edges {
    if edge.From == enumID && edge.To == baseID && edge.Kind == EdgeValueCall {
      found = true
      break
    }
  }
  if !found {
    t.Fatalf("no value-call edge from enum E to base(); enum initializer call was dropped")
  }
}
