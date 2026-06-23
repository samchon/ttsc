package graph

import (
  "path/filepath"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// fixtureTSConfig is the minimal tsconfig the graph probes compile their
// single-file fixtures with. ES2022 + commonjs keeps lib resolution light and
// extensionless relative imports working.
const fixtureTSConfig = `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "strict": true,
    "rootDir": "src",
    "outDir": "dist"
  },
  "files": ["src/main.ts"]
}
`

// TestBuildRecordsANodePerTopLevelDeclaration verifies that Build records one
// graph node for each kind of top-level declaration, keyed by its
// position-invariant id, and classifies workspace source as non-external.
//
// It pins the declaration-to-node mapping the rest of the graph is laid over: a
// missing kind here is an edge with no endpoint later. driver.SourceFiles drops
// declaration files, so every node must report External=false.
//
//  1. Compile a fixture with a function, class, interface, type alias, enum, and
//     const declaration.
//  2. Build the graph.
//  3. Assert exactly those six nodes exist with the right kind and name, none
//     marked external.
func TestBuildRecordsANodePerTopLevelDeclaration(t *testing.T) {
  root := t.TempDir()
  writeFile(t, filepath.Join(root, "tsconfig.json"), fixtureTSConfig)
  writeFile(t, filepath.Join(root, "src", "main.ts"), `export function fn(): void {}
export class Cls {}
export interface Iface {}
export type Alias = number;
export enum En {
  A,
}
export const value = 1;
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

  want := map[string]NodeKind{
    "fn":    NodeFunction,
    "Cls":   NodeClass,
    "Iface": NodeInterface,
    "Alias": NodeTypeAlias,
    "En":    NodeEnum,
    "value": NodeVariable,
  }
  if len(graph.Nodes) != len(want) {
    t.Fatalf("expected %d nodes, got %d: %v", len(want), len(graph.Nodes), nodeIDSet(graph))
  }
  for name, kind := range want {
    id := nodeID(path, name, kind)
    node, ok := graph.Nodes[id]
    if !ok {
      t.Fatalf("missing node for %s (%s); have %v", name, kind, nodeIDSet(graph))
    }
    if node.Name != name || node.Kind != kind {
      t.Fatalf("node %s: got name=%q kind=%q", id, node.Name, node.Kind)
    }
    if node.External {
      t.Fatalf("workspace declaration %s misclassified as external", id)
    }
  }
}

// nodeIDSet returns the graph's node ids as a slice for failure messages.
func nodeIDSet(graph *Graph) []string {
  ids := make([]string, 0, len(graph.Nodes))
  for id := range graph.Nodes {
    ids = append(ids, id)
  }
  return ids
}
