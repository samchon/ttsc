package graph

import (
  "path/filepath"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestFunctionLocalsDoNotCollide verifies that a function-local declaration is
// not minted as a graph node. Build records top-level declarations, namespace
// members, and class/interface members only; a body-scoped local resolved as an
// edge target has an unqualified, position-free id, so two same-named locals in
// different scopes would key the same node and merge — fabricating a false edge
// from each unrelated caller to one phantom callable.
func TestFunctionLocalsDoNotCollide(t *testing.T) {
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
  writeFile(t, filepath.Join(root, "src", "main.ts"), `export function outerA(): number {
  function inner(): number {
    return 1;
  }
  return inner();
}

export function outerB(): number {
  function inner(): number {
    return 2;
  }
  return inner();
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

  // No function-local node is minted...
  if _, ok := graph.Nodes[nodeID(path, "inner", NodeFunction)]; ok {
    t.Fatalf("a function-local 'inner' was minted as a node (would collide across scopes)")
  }
  // ...so no edge points at a phantom shared 'inner'.
  for _, edge := range graph.Edges {
    if to := graph.Nodes[edge.To]; to != nil && to.Name == "inner" {
      t.Fatalf("edge to a function-local 'inner' (false cross-scope merge): %v", edge)
    }
  }
}
