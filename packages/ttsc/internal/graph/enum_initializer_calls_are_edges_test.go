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
