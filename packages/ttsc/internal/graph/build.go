package graph

import (
  shimast "github.com/microsoft/typescript-go/shim/ast"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// Build walks the program's user-authored source files and records a node for
// each top-level declaration. driver.SourceFiles already drops declaration files
// and the program never compiles a dependency's `.ts`, so every node Build emits
// is workspace source: External is false. External boundary leaves enter the
// graph only as the resolved target of an edge (see Resolve).
func Build(prog *driver.Program) *Graph {
  g := &Graph{Nodes: map[string]*Node{}}
  for _, file := range prog.SourceFiles() {
    collectDeclarations(g, file)
  }
  g.addEdges(prog)
  return g
}

// collectDeclarations records a node for each top-level declaration statement in
// file. Nested declarations (methods, locals) are added by later passes; this
// pass establishes the top-level symbol nodes that cross-file edges connect.
func collectDeclarations(g *Graph, file *shimast.SourceFile) {
  if file.Statements == nil {
    return
  }
  path := file.FileName()
  for _, statement := range file.Statements.Nodes {
    switch statement.Kind {
    case shimast.KindFunctionDeclaration:
      addNode(g, path, statement, NodeFunction)
    case shimast.KindClassDeclaration:
      addNode(g, path, statement, NodeClass)
    case shimast.KindInterfaceDeclaration:
      addNode(g, path, statement, NodeInterface)
    case shimast.KindTypeAliasDeclaration:
      addNode(g, path, statement, NodeTypeAlias)
    case shimast.KindEnumDeclaration:
      addNode(g, path, statement, NodeEnum)
    case shimast.KindVariableStatement:
      collectVariables(g, path, statement)
    }
  }
}

// collectVariables records a variable node for each binding in a top-level
// variable statement (both bindings of `const a = 1, b = 2`).
func collectVariables(g *Graph, path string, statement *shimast.Node) {
  variables := statement.AsVariableStatement()
  if variables == nil || variables.DeclarationList == nil {
    return
  }
  list := variables.DeclarationList.AsVariableDeclarationList()
  if list == nil || list.Declarations == nil {
    return
  }
  for _, binding := range list.Declarations.Nodes {
    addNode(g, path, binding, NodeVariable)
  }
}

// addNode records a node for the symbol declared by node under its
// position-invariant id. A declaration the checker did not bind to a single
// named symbol (a destructuring pattern) is skipped, and a redeclaration (a
// merged interface, an overload set) keeps the first node.
func addNode(g *Graph, path string, node *shimast.Node, kind NodeKind) {
  symbol := node.Symbol()
  if symbol == nil || symbol.Name == "" {
    return
  }
  id := nodeID(path, symbol.Name, kind)
  if _, exists := g.Nodes[id]; exists {
    return
  }
  g.Nodes[id] = &Node{
    ID:   id,
    Name: symbol.Name,
    Kind: kind,
    File: path,
  }
}
