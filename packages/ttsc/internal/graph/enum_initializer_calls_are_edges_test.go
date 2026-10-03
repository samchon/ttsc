package graph

import (
  "path/filepath"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestEnumInitializerCallsAreEdges pins that a value-call inside a (non-const)
// enum member initializer is recorded as an edge from the enum node. build.go
// records the enum as a node, but the edge pass must also walk the enum body, or
// the call in `A = base()` is silently dropped — the gap a round-1 reviewer found.
//
// 1. Load enum E whose A initializer calls base.
// 2. Build the enum and initializer relations.
// 3. Require the E node and its value-call edge to base.
//
// @evidence contracts/testing.md#behavioral-verification Require the E node and its value-call edge to base.
// @evidence contracts/testing.md#independent-expectations The expectation is literal: for export enum E { A = base() } the graph must hold the E enum node and a value-call edge from E to the base function; dropping the initializer walk fails the edge check.
// @evidence contracts/testing.md#distinguishing-cases Load enum E whose A initializer calls base. Build the enum and initializer relations. Require the E node and its value-call edge to base.
// @evidence contracts/testing.md#execution-ownership TestEnumInitializerCallsAreEdges is a Go source-unit entry. Build, nodeID execute directly over the authored source or explicit input facts. The owning operations stay in this test process, without installing a consumer or building or starting a native product binary.
func TestEnumInitializerCallsAreEdges(t *testing.T) {
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
