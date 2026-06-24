package graph

import (
  "strings"

  shimast "github.com/microsoft/typescript-go/shim/ast"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// Build walks the program's user-authored source files and records a node for
// each top-level declaration. driver.SourceFiles already drops declaration files
// and the program never compiles a dependency's `.ts`, so every node Build emits
// is workspace source: External is false. External boundary leaves enter the
// graph only as the resolved target of an edge (see Resolve).
func Build(prog *driver.Program) *Graph {
  g := &Graph{
    Nodes:     map[string]*Node{},
    bodyNodes: map[string]bool{},
    seen:      map[string]struct{}{},
  }
  for _, file := range prog.SourceFiles() {
    collectDeclarations(g, file)
  }
  g.addEdges(prog)
  return g
}

// collectDeclarations records a node for each declaration statement in file,
// plus a method node for each callable member of a class or interface, so
// method-to-method calls have both endpoints. It descends into namespace bodies
// so a `namespace X { … }` member is a node too, keyed by its namespace-qualified
// name. This pass establishes the symbol nodes that cross-file edges connect.
func collectDeclarations(g *Graph, file *shimast.SourceFile) {
  if file.Statements == nil {
    return
  }
  collectStatements(g, file.FileName(), file.Statements.Nodes)
}

// collectStatements records the nodes for a statement list — the file's top
// level, or the body of a namespace it recurses into. A member's id is built
// from its symbol, which already carries the enclosing namespace in its parent
// chain, so a node recorded here and an edge target resolved later agree without
// the walk having to thread the namespace name through.
func collectStatements(g *Graph, path string, statements []*shimast.Node) {
  for _, statement := range statements {
    switch statement.Kind {
    case shimast.KindFunctionDeclaration:
      addNode(g, path, statement, NodeFunction)
    case shimast.KindClassDeclaration:
      addNode(g, path, statement, NodeClass)
      collectMembers(g, path, statement)
    case shimast.KindInterfaceDeclaration:
      addNode(g, path, statement, NodeInterface)
      collectMembers(g, path, statement)
    case shimast.KindTypeAliasDeclaration:
      addNode(g, path, statement, NodeTypeAlias)
    case shimast.KindEnumDeclaration:
      addNode(g, path, statement, NodeEnum)
    case shimast.KindVariableStatement:
      collectVariables(g, path, statement)
    case shimast.KindModuleDeclaration:
      // `namespace X { … }` — its members are declarations in their own right,
      // so recurse into the body. The namespace itself is a grouping container,
      // not a referenceable symbol the graph models as a node.
      collectStatements(g, path, moduleStatements(statement))
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
// named symbol (a destructuring pattern) is skipped. Redeclarations keep the
// first node except callable overload sets, where the implementation body
// replaces earlier signature-only declarations so graph answers show executable
// code instead of just the overload header.
func addNode(g *Graph, path string, node *shimast.Node, kind NodeKind) {
  symbol := node.Symbol()
  if symbol == nil || symbol.Name == "" {
    return
  }
  putDeclaredNode(g, path, qualifiedName(symbol), kind, node)
}

// collectMembers records callable members (method, constructor, accessor) and
// property members of a class or interface declaration, keyed by their
// class-qualified names so resolved member references land on the same node.
func collectMembers(g *Graph, path string, statement *shimast.Node) {
  for _, member := range classMembers(statement) {
    name := methodName(member.Symbol())
    if name == "" {
      continue
    }
    switch {
    case isMethodMember(member.Kind):
      putDeclaredNode(g, path, name, NodeMethod, member)
    case isPropertyMember(member.Kind):
      putDeclaredNode(g, path, name, NodeVariable, member)
    }
  }
}

func putDeclaredNode(g *Graph, path, name string, kind NodeKind, declaration *shimast.Node) {
  id := nodeID(path, name, kind)
  hasBody := declarationHasImplementation(declaration, kind)
  if _, exists := g.Nodes[id]; exists {
    if !hasBody || g.bodyNodes[id] {
      return
    }
  }
  g.Nodes[id] = &Node{
    ID:   id,
    Name: name,
    Kind: kind,
    File: path,
    Pos:  declaration.Pos(),
    End:  declaration.End(),
  }
  g.bodyNodes[id] = hasBody
}

func declarationHasImplementation(declaration *shimast.Node, kind NodeKind) bool {
  switch kind {
  case NodeFunction, NodeMethod:
    return declaration.Body() != nil
  default:
    return false
  }
}

// classMembers returns the member nodes of a class or interface declaration, or
// nil for anything else.
func classMembers(statement *shimast.Node) []*shimast.Node {
  switch statement.Kind {
  case shimast.KindClassDeclaration:
    if decl := statement.AsClassDeclaration(); decl != nil && decl.Members != nil {
      return decl.Members.Nodes
    }
  case shimast.KindInterfaceDeclaration:
    if decl := statement.AsInterfaceDeclaration(); decl != nil && decl.Members != nil {
      return decl.Members.Nodes
    }
  }
  return nil
}

// isMethodMember reports whether a class/interface member kind is a callable the
// graph models as a method node.
func isMethodMember(kind shimast.Kind) bool {
  switch kind {
  case shimast.KindMethodDeclaration, shimast.KindMethodSignature,
    shimast.KindConstructor, shimast.KindGetAccessor, shimast.KindSetAccessor:
    return true
  default:
    return false
  }
}

func isPropertyMember(kind shimast.Kind) bool {
  switch kind {
  case shimast.KindPropertyDeclaration, shimast.KindPropertySignature:
    return true
  default:
    return false
  }
}

// methodName returns the qualified, printable name of a method symbol
// ("Class.method", or "Namespace.Class.method" for a method of a namespaced
// class), or "" when it has no named parent (a synthesized member).
// symbol.Parent is the class/interface symbol, set by the binder for every
// member.
func methodName(symbol *shimast.Symbol) string {
  if symbol == nil || symbol.Name == "" || symbol.Parent == nil || symbol.Parent.Name == "" {
    return ""
  }
  return qualifiedName(symbol)
}

// qualifiedName is the identity name of a symbol: its own name, prefixed by the
// dotted chain of every enclosing namespace and declaring class or interface. A
// declaration at a module's top level has no such container, so its name is
// returned unchanged, which keeps every existing top-level node id stable. A
// constructor's internal-name prefix (\xFE) is escaped to "__".
func qualifiedName(symbol *shimast.Symbol) string {
  if symbol == nil || symbol.Name == "" {
    return ""
  }
  name := strings.ReplaceAll(symbol.Name, "\xFE", "__")
  if prefix := containerPrefix(symbol); prefix != "" {
    return prefix + "." + name
  }
  return name
}

// containerPrefix returns the qualified name of symbol's enclosing namespace or
// declaring class/interface, or "" at a module's top level. The source-file
// module symbol is not a namespace — its declaration is the file, not a
// `namespace` block — so a top-level declaration gets no prefix.
func containerPrefix(symbol *shimast.Symbol) string {
  parent := symbol.Parent
  if parent == nil || parent.Name == "" {
    return ""
  }
  if isNamespaceSymbol(parent) || isTypeContainerSymbol(parent) {
    return qualifiedName(parent)
  }
  return ""
}

// isNamespaceSymbol reports whether symbol is declared by a `namespace` / `module`
// block, the container whose members the graph qualifies by name. A string-named
// ambient module (`declare module "x"`) and the `global` augmentation scope are
// also module declarations, but qualifying members by their quoted or internal
// names would produce malformed ids, so they are excluded.
func isNamespaceSymbol(symbol *shimast.Symbol) bool {
  if strings.HasPrefix(symbol.Name, "\"") || strings.Contains(symbol.Name, "\xFE") {
    return false
  }
  for _, declaration := range symbol.Declarations {
    if declaration.Kind == shimast.KindModuleDeclaration {
      return true
    }
  }
  return false
}

// isTypeContainerSymbol reports whether symbol is a class or interface, whose
// members the graph qualifies ("Class.method").
func isTypeContainerSymbol(symbol *shimast.Symbol) bool {
  return symbol.Flags&(shimast.SymbolFlagsClass|shimast.SymbolFlagsInterface) != 0
}

// moduleStatements returns the member statements inside a namespace/module body,
// or nil. `namespace A.B { … }` nests B's module declaration as A's body rather
// than a block, so descend through any chained module declarations to reach the
// block.
func moduleStatements(statement *shimast.Node) []*shimast.Node {
  body := statement.Body()
  for body != nil && body.Kind == shimast.KindModuleDeclaration {
    body = body.Body()
  }
  if body == nil || body.Kind != shimast.KindModuleBlock {
    return nil
  }
  block := body.AsModuleBlock()
  if block == nil || block.Statements == nil {
    return nil
  }
  return block.Statements.Nodes
}
