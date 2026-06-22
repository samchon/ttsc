package graph

import (
  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimchecker "github.com/microsoft/typescript-go/shim/checker"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// addEdges resolves the relationships between the declaration nodes Build
// recorded. It walks each source file again and, for every class or interface,
// resolves its heritage bases through the checker (unwrapping barrel re-exports
// to the real declaration) and links the declaration to that base, materializing
// an external boundary-leaf node when the base lives in node_modules or a `.d.ts`.
func (g *Graph) addEdges(prog *driver.Program) {
  checker := prog.Checker
  for _, file := range prog.SourceFiles() {
    g.collectHeritage(checker, file)
  }
}

// collectHeritage adds a heritage edge for every base of every top-level class
// and interface in file.
func (g *Graph) collectHeritage(checker *shimchecker.Checker, file *shimast.SourceFile) {
  if file.Statements == nil {
    return
  }
  path := file.FileName()
  for _, statement := range file.Statements.Nodes {
    switch statement.Kind {
    case shimast.KindClassDeclaration:
      decl := statement.AsClassDeclaration()
      if decl != nil && decl.HeritageClauses != nil {
        g.heritageEdges(checker, path, statement, NodeClass, decl.HeritageClauses.Nodes)
      }
    case shimast.KindInterfaceDeclaration:
      decl := statement.AsInterfaceDeclaration()
      if decl != nil && decl.HeritageClauses != nil {
        g.heritageEdges(checker, path, statement, NodeInterface, decl.HeritageClauses.Nodes)
      }
    }
  }
}

// heritageEdges resolves each base expression of node's heritage clauses and
// records a heritage edge from node to the resolved base node.
func (g *Graph) heritageEdges(checker *shimchecker.Checker, path string, node *shimast.Node, kind NodeKind, clauses []*shimast.Node) {
  symbol := node.Symbol()
  if symbol == nil || symbol.Name == "" {
    return
  }
  from := nodeID(path, symbol.Name, kind)
  for _, clauseNode := range clauses {
    clause := clauseNode.AsHeritageClause()
    if clause == nil || clause.Types == nil {
      continue
    }
    for _, typeNode := range clause.Types.Nodes {
      base := typeNode.AsExpressionWithTypeArguments()
      if base == nil || base.Expression == nil {
        continue
      }
      target := Resolve(checker, base.Expression)
      if target == nil || target.Symbol == nil {
        continue
      }
      to := g.ensureTargetNode(target)
      if to == "" {
        continue
      }
      g.Edges = append(g.Edges, &Edge{From: from, To: to, Kind: EdgeHeritage})
    }
  }
}

// ensureTargetNode returns the node id for a resolved edge target, creating the
// node when the resolution pass reached a symbol Build did not record: an
// external boundary leaf (node_modules / `.d.ts`), kept as a leaf so the graph
// stays "your code" without descending into a dependency's internals. Returns ""
// when the symbol is not a kind the graph models as a node.
func (g *Graph) ensureTargetNode(target *Target) string {
  kind := symbolNodeKind(target.Symbol)
  if kind == "" {
    return ""
  }
  id := nodeID(target.File, target.Symbol.Name, kind)
  if _, exists := g.Nodes[id]; !exists {
    g.Nodes[id] = &Node{
      ID:       id,
      Name:     target.Symbol.Name,
      Kind:     kind,
      File:     target.File,
      External: target.External,
    }
  }
  return id
}

// symbolNodeKind maps a resolved symbol's flags to a NodeKind, or "" when the
// symbol is not a kind the graph records as a node.
func symbolNodeKind(symbol *shimast.Symbol) NodeKind {
  switch {
  case symbol.Flags&shimast.SymbolFlagsClass != 0:
    return NodeClass
  case symbol.Flags&shimast.SymbolFlagsInterface != 0:
    return NodeInterface
  case symbol.Flags&shimast.SymbolFlagsTypeAlias != 0:
    return NodeTypeAlias
  case symbol.Flags&shimast.SymbolFlagsEnum != 0:
    return NodeEnum
  case symbol.Flags&shimast.SymbolFlagsFunction != 0:
    return NodeFunction
  case symbol.Flags&shimast.SymbolFlagsVariable != 0:
    return NodeVariable
  default:
    return ""
  }
}
