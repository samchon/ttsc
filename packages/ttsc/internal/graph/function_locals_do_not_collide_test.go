package graph

import (
  "path/filepath"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestFunctionLocalsDoNotCollide verifies distinct local callables do not share an unqualified graph identity.
//
// Two outer scopes each declare inner. An unqualified, position-free inner
// identity would merge unrelated call targets; these assertions permit separately
// scope-qualified callable facts.
//
// 1. Load outerA and outerB, each with its own inner declaration.
// 2. Build declarations and their relations from the real compiler.
// 3. Reject the unqualified inner node and edges to that shared identity.
//
// @evidence contracts/testing.md#behavioral-verification Build must not merge the two local inner callables into one unqualified node identity or target an edge at that phantom shared identity.
// @evidence contracts/testing.md#independent-expectations The two literal outer functions define distinct lexical inner declarations. The unqualified nodeID(path, inner, NodeFunction) and an edge target named only inner would erase that scope distinction; scope-qualified callable nodes are not prohibited by these assertions.
// @evidence contracts/testing.md#distinguishing-cases Two same-named locals in separate outer scopes contrast permitted scoped declarations with a colliding unqualified node or edge target.
// @evidence contracts/testing.md#execution-ownership The source-unit entry loads the authored source through driver.LoadProgram and calls Build and nodeID in the Go test process, closing its Program before temporary fixture cleanup.
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
