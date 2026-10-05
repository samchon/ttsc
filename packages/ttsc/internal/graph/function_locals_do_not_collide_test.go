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
//  1. Load outerA and outerB, each with its own inner declaration.
//  2. Build declarations and their relations from the real compiler.
//  3. Require each scoped inner and its owner's call, then reject the unqualified
//     inner node and edges to that shared identity.
//
// @evidence contracts/testing.md#behavioral-verification Build must retain outerA.inner and outerB.inner with their respective outer-to-inner call edges, while creating neither an unqualified inner node nor an edge to an unqualified inner target. Empty or dropped-local graphs cannot satisfy the positive counterpart.
// @evidence contracts/testing.md#independent-expectations The two literal named outer functions define separate lexical inner declarations. Literal scoped names and owner/target pairs follow that nesting; the shared ID formatter selects their coordinates rather than supplying an independent ID-grammar oracle. An unqualified inner identity would erase the tested scope distinction.
// @evidence contracts/testing.md#distinguishing-cases Two same-named locals in separate named outer scopes require their own scoped nodes and call targets, contrasting a colliding unqualified node or edge. Anonymous owners, deeper scopes and source position identity are not asserted here.
// @evidence contracts/testing.md#execution-ownership This Go source-unit writes a native project, constructs/closes a driver Program in-process and directly calls Build. Actual Program filenames and shared nodeID formatting select literal scoped endpoints. A restored empty linked-plugin manifest excludes ambient hooks; no consumer installation or product process runs.
func TestFunctionLocalsDoNotCollide(t *testing.T) {
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

  for _, owner := range []string{"outerA", "outerB"} {
    localID := nodeID(path, owner+".inner", NodeFunction)
    if local := graph.Nodes[localID]; local == nil || local.Name != owner+".inner" {
      t.Fatalf("missing scoped local %s.inner; nodes: %v", owner, nodeIDSet(graph))
    }
    if !hasEdge(graph, nodeID(path, owner, NodeFunction), localID, EdgeValueCall) {
      t.Fatalf("missing %s -> %s.inner call; edges: %v", owner, owner, graph.Edges)
    }
  }

  // No unqualified function-local node is minted...
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
