package graph

import (
  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimchecker "github.com/microsoft/typescript-go/shim/checker"
)

// markExports records a module's export surface: a node for the module itself
// and an `exports` edge to every declaration its export table resolves to. It
// runs on the checker, so it sees the real public surface — an inline
// `export class`, a separate `export { Foo }`, a re-export
// `export { Foo } from "./foo"`, and a barrel `export *` all land here, where a
// purely syntactic `export`-modifier scan would miss the re-export forms that
// carry most of a monorepo's public API. Each resolved node is also flagged
// Exported.
//
// The edge is what the flag cannot say. A package's front door and its legacy
// subpath both re-export, so both surfaces end up Exported and a ranker that
// reads the flag alone cannot tell zod's `.` entry from its `./v3` one: it picks
// whichever name matches the query best, which is how a tour of the current API
// came back centered on the legacy implementation. The edge keeps the module the
// symbol came out of, so a caller holding a package.json — which names its entry
// file and nothing else — can ask the graph what that file, and only that file,
// puts on the wire.
//
// A barrel declares nothing of its own, so without a module node it is absent
// from the graph entirely: the file a package.json points at, the one thing that
// answers "what is this package's public API", is the one file the index never
// had. The module node is that anchor, and the export edges hang from it.
func (g *Graph) markExports(checker *shimchecker.Checker, file *shimast.SourceFile) {
  moduleSymbol := checker.GetSymbolAtLocation(file.AsNode())
  if moduleSymbol == nil {
    return
  }
  exports := shimchecker.Checker_getExportsOfModule(checker, moduleSymbol)
  if len(exports) == 0 {
    return
  }
  module := g.putModuleNode(file)
  for _, export := range exports {
    symbol := export
    // A re-export is an alias; unwrap it to the declaration it points at so the
    // exported flag lands on the real node, not a re-exporting index file's
    // local alias symbol (which has no node of its own).
    if symbol.Flags&shimast.SymbolFlagsAlias != 0 {
      if aliased := shimchecker.Checker_getAliasedSymbol(checker, symbol); aliased != nil {
        symbol = aliased
      }
    }
    if id, ok := g.markExportedSymbol(symbol); ok {
      g.addEdge(module.ID, id, EdgeExports)
    }
  }
}

// putModuleNode records the node for a source file. Its name is the file path,
// the only name a module has that a caller can hold.
//
// Every source file gets one, exporting or not, because a module is also what
// runs a file's top-level statements — and those statements are where a test
// file keeps everything it does. `describe(() => it(() => schema.parse(x)))` is
// a call the checker resolves and the graph used to drop on the floor: it sits
// inside a callback, no declaration owns it, and edges are attributed to owners.
// A whole test suite left no trace, which is why a tour that promised the tests
// to read next could name two of zod's and none of NestJS's, and why the model
// went off to glob for them.
func (g *Graph) putModuleNode(file *shimast.SourceFile) *Node {
  path := file.FileName()
  id := nodeID(path, path, NodeModule)
  if existing, ok := g.Nodes[id]; ok {
    return existing
  }
  node := &Node{
    ID:     id,
    Name:   path,
    Simple: path,
    Kind:   NodeModule,
    File:   path,
    // A module that exports is by definition part of some surface; whether it is
    // the package's front door is the package.json's to say, not the graph's.
    Exported: true,
  }
  g.Nodes[id] = node
  return node
}

// markExportedSymbol sets Exported on the node a resolved export symbol declares
// and returns that node's id. A symbol whose declaration the graph does not model
// as a node (a re-exported value from a dependency, a kind it does not track) is
// skipped rather than fabricated.
func (g *Graph) markExportedSymbol(symbol *shimast.Symbol) (string, bool) {
  declaration := declarationNode(symbol)
  if declaration == nil {
    return "", false
  }
  file := shimast.GetSourceFileOfNode(declaration)
  if file == nil {
    return "", false
  }
  kind := symbolNodeKind(symbol)
  if kind == "" {
    return "", false
  }
  name := qualifiedName(symbol)
  if kind == NodeMethod {
    name = methodName(symbol)
  }
  if name == "" {
    return "", false
  }
  node, ok := g.Nodes[nodeID(file.FileName(), name, kind)]
  if !ok {
    return "", false
  }
  node.Exported = true
  return node.ID, true
}
