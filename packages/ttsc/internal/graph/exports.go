package graph

import (
  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimchecker "github.com/microsoft/typescript-go/shim/checker"
)

// markExports flags every node reachable through a source file's export table as
// Exported. It runs on the checker, so it sees the real public surface: an
// inline `export class`, a separate `export { Foo }`, a re-export
// `export { Foo } from "./foo"`, and a barrel `export *` all land here, where a
// purely syntactic `export`-modifier scan would miss the re-export forms that
// carry most of a monorepo's public API.
func (g *Graph) markExports(checker *shimchecker.Checker, file *shimast.SourceFile) {
  moduleSymbol := checker.GetSymbolAtLocation(file.AsNode())
  if moduleSymbol == nil {
    return
  }
  for _, export := range shimchecker.Checker_getExportsOfModule(checker, moduleSymbol) {
    symbol := export
    // A re-export is an alias; unwrap it to the declaration it points at so the
    // exported flag lands on the real node, not a re-exporting index file's
    // local alias symbol (which has no node of its own).
    if symbol.Flags&shimast.SymbolFlagsAlias != 0 {
      if aliased := shimchecker.Checker_getAliasedSymbol(checker, symbol); aliased != nil {
        symbol = aliased
      }
    }
    g.markExportedSymbol(symbol)
  }
}

// markExportedSymbol sets Exported on the node a resolved export symbol declares,
// when the graph recorded one. A symbol whose declaration the graph does not
// model as a node (a re-exported value from a dependency, a kind it does not
// track) is skipped rather than fabricated.
func (g *Graph) markExportedSymbol(symbol *shimast.Symbol) {
  declaration := declarationNode(symbol)
  if declaration == nil {
    return
  }
  file := shimast.GetSourceFileOfNode(declaration)
  if file == nil {
    return
  }
  kind := symbolNodeKind(symbol)
  if kind == "" {
    return
  }
  name := qualifiedName(symbol)
  if kind == NodeMethod {
    name = methodName(symbol)
  }
  if name == "" {
    return
  }
  if node, ok := g.Nodes[nodeID(file.FileName(), name, kind)]; ok {
    node.Exported = true
  }
}
