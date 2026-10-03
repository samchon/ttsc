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
// graph node for each of six authored top-level declaration kinds and
// classifies those workspace nodes as non-external.
//
// It pins the declaration-to-node mapping the rest of the graph is laid over: a
// missing kind here would leave an expected endpoint absent. Build filters
// declaration files before collecting these authored source declarations.
//
//  1. Compile a fixture with a function, class, interface, type alias, enum, and
//     const declaration.
//  2. Build the graph.
//  3. Assert exactly those six nodes exist with the right kind and name, none
//     marked external.
//
// @evidence contracts/testing.md#behavioral-verification Build returns exactly six non-module nodes for the authored declaration names and kinds, each non-external. No source-position change is performed.
// @evidence contracts/testing.md#independent-expectations The six literal pairs fn/function, Cls/class, Iface/interface, Alias/type-alias, En/enum and value/variable must match the non-module population and non-external classification. IDs use the owning nodeID formatter and the Program-reported path, so ID grammar and position invariance are not independently certified.
// @evidence contracts/testing.md#distinguishing-cases Compile a fixture with a function, class, interface, type alias, enum, and const declaration; Build the graph; Assert exactly those six nodes exist with the right kind and name, none marked external.
// @evidence contracts/testing.md#execution-ownership This graph Go source-unit writes its native temporary project, constructs and closes a driver compiler Program in-process, and calls Build directly. A restored empty linked-plugin manifest excludes ambient hooks; no installed consumer or native product command is used.
func TestBuildRecordsANodePerTopLevelDeclaration(t *testing.T) {
  t.Setenv(driver.LinkedPluginsEnv, "")
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
  // The module node is the file's export surface, not a declaration in it, so
  // the declaration count excludes it.
  if declared := declaredNodeCount(graph); declared != len(want) {
    t.Fatalf("expected %d nodes, got %d: %v", len(want), declared, nodeIDSet(graph))
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

// declaredNodeCount counts the nodes that stand for a declaration, leaving out
// the module node a file's export table adds.
func declaredNodeCount(graph *Graph) int {
  count := 0
  for _, node := range graph.Nodes {
    if node.Kind != NodeModule {
      count++
    }
  }
  return count
}

// nodeIDSet returns the graph's node ids as a slice for failure messages.
func nodeIDSet(graph *Graph) []string {
  ids := make([]string, 0, len(graph.Nodes))
  for id := range graph.Nodes {
    ids = append(ids, id)
  }
  return ids
}
