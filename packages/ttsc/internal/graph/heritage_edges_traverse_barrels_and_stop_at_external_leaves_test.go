package graph

import (
  "path/filepath"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestHeritageEdgesTraverseBarrelsAndStopAtExternalLeaves verifies the two edge
// behaviors that distinguish a checker-resolved graph from a path-heuristic one:
// a heritage edge into a barrel-re-exported base lands on the sibling source
// that declares it (not the index file), and a heritage edge into a dependency
// becomes an external boundary leaf that the walk does not descend into.
//
//  1. Compile a fixture: `Sub extends Base` where Base is re-exported through a
//     barrel, and `SubExt extends Ext` where Ext is declared in a node_modules
//     `.d.ts`.
//  2. Build the graph.
//  3. Assert the Sub->Base edge targets the real declaration in impl.ts and is
//     not external, while the SubExt->Ext edge targets an external leaf under
//     node_modules.
func TestHeritageEdgesTraverseBarrelsAndStopAtExternalLeaves(t *testing.T) {
  root := t.TempDir()
  writeFile(t, filepath.Join(root, "tsconfig.json"), fixtureTSConfig)
  writeFile(t, filepath.Join(root, "node_modules", "dep", "package.json"), `{
  "name": "dep",
  "version": "1.0.0",
  "types": "index.d.ts"
}
`)
  writeFile(t, filepath.Join(root, "node_modules", "dep", "index.d.ts"), `export declare class Ext {}
`)
  writeFile(t, filepath.Join(root, "src", "impl.ts"), `export class Base {}
`)
  writeFile(t, filepath.Join(root, "src", "index.ts"), `export { Base } from "./impl";
`)
  writeFile(t, filepath.Join(root, "src", "main.ts"), `import { Base } from "./index";
import { Ext } from "dep";
export class Sub extends Base {}
export class SubExt extends Ext {}
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
  mainPath := sourceFile(t, prog, "main.ts").FileName()
  implPath := sourceFile(t, prog, "impl.ts").FileName()

  // Barrel traversal: the base resolved to the sibling source, not the index.
  base := nodeID(implPath, "Base", NodeClass)
  if node, ok := graph.Nodes[base]; !ok || node.External {
    t.Fatalf("Base node missing or misclassified external (barrel not traversed): %+v", node)
  }
  sub := nodeID(mainPath, "Sub", NodeClass)
  if !hasEdge(graph, sub, base, EdgeHeritage) {
    t.Fatalf("missing heritage edge Sub -> Base@impl.ts; edges: %v", graph.Edges)
  }

  // External leaf: the dependency base is a boundary leaf, kept as a node with
  // its incoming edge but never walked into.
  ext := findNodeByName(graph, "Ext")
  if ext == nil {
    t.Fatal("Ext base was not recorded as a node")
  }
  if !ext.External || !strings.Contains(ext.File, "/node_modules/") {
    t.Fatalf("Ext should be an external node_modules leaf: %+v", ext)
  }
  subExt := nodeID(mainPath, "SubExt", NodeClass)
  if !hasEdge(graph, subExt, ext.ID, EdgeHeritage) {
    t.Fatalf("missing heritage edge SubExt -> Ext (external); edges: %v", graph.Edges)
  }
}

// hasEdge reports whether the graph holds a from->to edge of the given kind.
func hasEdge(graph *Graph, from, to string, kind EdgeKind) bool {
  for _, edge := range graph.Edges {
    if edge.From == from && edge.To == to && edge.Kind == kind {
      return true
    }
  }
  return false
}

// hasDecorator reports whether the graph recorded a decorator named name on the
// node target.
func hasDecorator(graph *Graph, target, name string) bool {
  for _, dec := range graph.Decorators {
    if dec.Target == target && dec.Name == name {
      return true
    }
  }
  return false
}

// findNodeByName returns the first node whose declared name is name, or nil.
func findNodeByName(graph *Graph, name string) *Node {
  for _, node := range graph.Nodes {
    if node.Name == name {
      return node
    }
  }
  return nil
}
