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
    g.collectCalls(checker, file)
    g.collectTypeRefs(checker, file)
  }
}

// addEdge records a from->to edge of the given kind, skipping a duplicate so a
// caller that invokes the same function several times yields one edge, not one
// per call site. The dedup is an O(1) set lookup, so building N edges is O(N).
func (g *Graph) addEdge(from, to string, kind EdgeKind) {
  key := from + "\x00" + to + "\x00" + string(kind)
  if _, exists := g.seen[key]; exists {
    return
  }
  g.seen[key] = struct{}{}
  g.Edges = append(g.Edges, &Edge{From: from, To: to, Kind: kind})
}

// collectHeritage adds a heritage edge for every base of every class and
// interface in file, descending into namespace bodies so a namespaced class's
// bases are resolved too.
func (g *Graph) collectHeritage(checker *shimchecker.Checker, file *shimast.SourceFile) {
  if file.Statements == nil {
    return
  }
  g.collectHeritageIn(checker, file.FileName(), file.Statements.Nodes)
}

// collectHeritageIn adds heritage edges for the class/interface statements in a
// list — the file's top level, or a namespace body it recurses into.
func (g *Graph) collectHeritageIn(checker *shimchecker.Checker, path string, statements []*shimast.Node) {
  for _, statement := range statements {
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
    case shimast.KindModuleDeclaration:
      g.collectHeritageIn(checker, path, moduleStatements(statement))
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
  from := nodeID(path, qualifiedName(symbol), kind)
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
      g.addEdge(from, to, EdgeHeritage)
    }
  }
}

// collectCalls records a value-call edge from each declaration to every function,
// method, or constructor it invokes. The reference walk is attributed to the
// nearest enclosing graph node: a top-level function, a class/interface method, a
// top-level variable binding, or the class itself for a member that is not a
// method (a property initializer).
func (g *Graph) collectCalls(checker *shimchecker.Checker, file *shimast.SourceFile) {
  forEachContainer(file.FileName(), file, func(from string, node *shimast.Node) {
    g.callsWithin(checker, from, node)
  })
}

// forEachContainer calls fn(nodeID, subtree) for every graph node that can hold
// call or type references, paired with the subtree to walk for it. A class or
// interface is split: each method member is attributed to its own method node, and
// every other member (a property initializer) to the type node, so a call made
// inside one method is not confused with another's.
func forEachContainer(path string, file *shimast.SourceFile, fn func(string, *shimast.Node)) {
  if file.Statements == nil {
    return
  }
  forEachContainerIn(path, file.Statements.Nodes, fn)
}

// forEachContainerIn pairs each graph node with its subtree for a statement list
// — the file's top level, or a namespace body it recurses into, so a call or
// type reference made inside a namespace member is attributed to that member.
func forEachContainerIn(path string, statements []*shimast.Node, fn func(string, *shimast.Node)) {
  for _, statement := range statements {
    switch statement.Kind {
    case shimast.KindFunctionDeclaration:
      if id := topLevelID(path, statement, NodeFunction); id != "" {
        fn(id, statement)
      }
    case shimast.KindTypeAliasDeclaration:
      if id := topLevelID(path, statement, NodeTypeAlias); id != "" {
        fn(id, statement)
      }
    case shimast.KindClassDeclaration:
      forEachMember(path, statement, NodeClass, fn)
    case shimast.KindInterfaceDeclaration:
      forEachMember(path, statement, NodeInterface, fn)
    case shimast.KindVariableStatement:
      forEachVariable(path, statement, fn)
    case shimast.KindModuleDeclaration:
      forEachContainerIn(path, moduleStatements(statement), fn)
    }
  }
}

// topLevelID returns the node id for a named declaration, or "". The name is
// namespace-qualified, so a namespaced declaration lands on the node the build
// pass recorded.
func topLevelID(path string, statement *shimast.Node, kind NodeKind) string {
  symbol := statement.Symbol()
  if symbol == nil || symbol.Name == "" {
    return ""
  }
  return nodeID(path, qualifiedName(symbol), kind)
}

// forEachMember attributes a class/interface's method members to their method
// node and its remaining members to the type node, then attributes the
// declaration's own class-level references to the type node.
func forEachMember(path string, statement *shimast.Node, kind NodeKind, fn func(string, *shimast.Node)) {
  containerID := topLevelID(path, statement, kind)
  for _, member := range classMembers(statement) {
    if isMethodMember(member.Kind) {
      if name := methodName(member.Symbol()); name != "" {
        fn(nodeID(path, name, NodeMethod), member)
        continue
      }
    }
    if containerID != "" {
      fn(containerID, member)
    }
  }
  if containerID == "" {
    return
  }
  // The references that live on the declaration itself rather than in a member
  // belong to the type node: a decorator factory call (`@Injectable()`), a type
  // parameter constraint (`<T extends Base>`), and a heritage type argument
  // (`extends Base<Payload>`). The per-member walk above never sees these, so
  // attribute each class-level subtree here or the edge is silently dropped.
  for _, decorator := range statement.Decorators() {
    fn(containerID, decorator)
  }
  for _, typeParam := range statement.TypeParameters() {
    fn(containerID, typeParam)
  }
  for _, clause := range heritageClauses(statement) {
    fn(containerID, clause)
  }
}

// heritageClauses returns the heritage clause nodes (`extends` / `implements`)
// of a class or interface declaration, or nil for anything else. Their type
// arguments are type references attributed to the declaration; the base
// expressions themselves become heritage edges in collectHeritage.
func heritageClauses(statement *shimast.Node) []*shimast.Node {
  switch statement.Kind {
  case shimast.KindClassDeclaration:
    if decl := statement.AsClassDeclaration(); decl != nil && decl.HeritageClauses != nil {
      return decl.HeritageClauses.Nodes
    }
  case shimast.KindInterfaceDeclaration:
    if decl := statement.AsInterfaceDeclaration(); decl != nil && decl.HeritageClauses != nil {
      return decl.HeritageClauses.Nodes
    }
  }
  return nil
}

// forEachVariable attributes each binding of a top-level variable statement to
// its variable node, so a call or type reference inside `const fn = () => …` is
// an edge from fn.
func forEachVariable(path string, statement *shimast.Node, fn func(string, *shimast.Node)) {
  variables := statement.AsVariableStatement()
  if variables == nil || variables.DeclarationList == nil {
    return
  }
  list := variables.DeclarationList.AsVariableDeclarationList()
  if list == nil || list.Declarations == nil {
    return
  }
  for _, binding := range list.Declarations.Nodes {
    symbol := binding.Symbol()
    if symbol == nil || symbol.Name == "" {
      continue
    }
    fn(nodeID(path, qualifiedName(symbol), NodeVariable), binding)
  }
}

// callsWithin walks node's subtree and records a value-call edge from `from` to
// the resolved target of every runtime use it finds: a call, a `new` expression,
// a tagged template, or a JSX element's component.
func (g *Graph) callsWithin(checker *shimchecker.Checker, from string, node *shimast.Node) {
  node.ForEachChild(func(child *shimast.Node) bool {
    switch child.Kind {
    case shimast.KindCallExpression:
      if call := child.AsCallExpression(); call != nil && call.Expression != nil {
        g.callEdge(checker, from, call.Expression)
      }
    case shimast.KindNewExpression:
      if newExpr := child.AsNewExpression(); newExpr != nil && newExpr.Expression != nil {
        g.callEdge(checker, from, newExpr.Expression)
      }
    case shimast.KindTaggedTemplateExpression:
      // A tagged template (styled`…`, gql`…`) is a call to its tag function.
      if tagged := child.AsTaggedTemplateExpression(); tagged != nil && tagged.Tag != nil {
        g.callEdge(checker, from, tagged.Tag)
      }
    case shimast.KindJsxSelfClosingElement:
      // `<Component />` is a use of the component; an intrinsic tag (`<div />`)
      // resolves to nothing and is dropped by callEdge.
      if jsx := child.AsJsxSelfClosingElement(); jsx != nil && jsx.TagName != nil {
        g.callEdge(checker, from, jsx.TagName)
      }
    case shimast.KindJsxOpeningElement:
      if jsx := child.AsJsxOpeningElement(); jsx != nil && jsx.TagName != nil {
        g.callEdge(checker, from, jsx.TagName)
      }
    }
    g.callsWithin(checker, from, child)
    return false
  })
}

// callEdge resolves a callee expression to its declaration and records a
// value-call edge, skipping an unresolved callee and a self-call.
func (g *Graph) callEdge(checker *shimchecker.Checker, from string, callee *shimast.Node) {
  target := Resolve(checker, callee)
  if target == nil || target.Symbol == nil {
    return
  }
  to := g.ensureTargetNode(target)
  if to == "" || to == from {
    return
  }
  g.addEdge(from, to, EdgeValueCall)
}

// collectTypeRefs records a type-ref edge from each top-level function, class,
// interface, or type alias to every named type it references in a type position
// (parameter, return, property, and alias right-hand-side types). Type
// references are first-class edges, which fits the ttsc thesis that types are
// the unit of truth: an `import type` or annotation-only dependency relates two
// symbols without any runtime call.
func (g *Graph) collectTypeRefs(checker *shimchecker.Checker, file *shimast.SourceFile) {
  forEachContainer(file.FileName(), file, func(from string, node *shimast.Node) {
    g.typeRefsWithin(checker, from, node)
  })
}

// typeRefsWithin walks node's subtree and records a type-ref edge from `from` to
// the resolved target of every type reference it finds. A plain named type is a
// KindTypeReference; the two other type-position shapes that name a symbol are a
// `typeof value` query and an `import("./m").Foo` type, whose name is an
// EntityName rather than a TypeReference, so each is matched explicitly. A
// surrounding `as` / `satisfies` expression needs no case of its own: the type
// it carries is itself one of these nodes, which the recursion reaches.
func (g *Graph) typeRefsWithin(checker *shimchecker.Checker, from string, node *shimast.Node) {
  node.ForEachChild(func(child *shimast.Node) bool {
    switch child.Kind {
    case shimast.KindTypeReference:
      if ref := child.AsTypeReferenceNode(); ref != nil && ref.TypeName != nil {
        g.typeRefEdge(checker, from, ref.TypeName)
      }
    case shimast.KindTypeQuery:
      // `typeof value` in a type position depends on that value's type.
      if query := child.AsTypeQueryNode(); query != nil && query.ExprName != nil {
        g.typeRefEdge(checker, from, query.ExprName)
      }
    case shimast.KindImportType:
      // `import("./m").Foo` references Foo through a dynamic import type; the
      // module argument is a string literal and resolves to nothing.
      if imp := child.AsImportTypeNode(); imp != nil && imp.Qualifier != nil {
        g.typeRefEdge(checker, from, imp.Qualifier)
      }
    }
    g.typeRefsWithin(checker, from, child)
    return false
  })
}

// typeRefEdge resolves a type name to its declaration and records a type-ref
// edge, skipping an unresolved name and a self-reference.
func (g *Graph) typeRefEdge(checker *shimchecker.Checker, from string, typeName *shimast.Node) {
  target := Resolve(checker, typeName)
  if target == nil || target.Symbol == nil {
    return
  }
  to := g.ensureTargetNode(target)
  if to == "" || to == from {
    return
  }
  g.addEdge(from, to, EdgeTypeRef)
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
  // A synthesized symbol without a declaration file would key a fileless ghost
  // node ("#name:kind") that could collide across distinct symbols; skip it.
  if target.File == "" {
    return ""
  }
  if kind == NodeMethod {
    // A method node is class-qualified and only modeled when it belongs to the
    // workspace (Build recorded it). A call into a dependency's method stops at
    // the boundary rather than spawning an external method leaf for every
    // `.map` / `.push` into a library type.
    name := methodName(target.Symbol)
    if name == "" {
      return ""
    }
    id := nodeID(target.File, name, NodeMethod)
    if _, exists := g.Nodes[id]; exists {
      return id
    }
    return ""
  }
  name := qualifiedName(target.Symbol)
  id := nodeID(target.File, name, kind)
  if _, exists := g.Nodes[id]; exists {
    return id
  }
  if !target.External {
    // A workspace target Build did not record is a function-local or otherwise
    // body-scoped declaration (Build records top-level declarations, namespace
    // members, and class/interface members only). Its name is unqualified and
    // position-free, so two same-named locals in different scopes would key the
    // same id and merge into one node, fabricating false edges. Drop it — the
    // same workspace-only discipline the NodeMethod branch already applies.
    return ""
  }
  g.Nodes[id] = &Node{
    ID:       id,
    Name:     name,
    Kind:     kind,
    File:     target.File,
    External: true,
    Pos:      target.Pos,
    End:      target.End,
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
  case symbol.Flags&(shimast.SymbolFlagsMethod|shimast.SymbolFlagsConstructor|shimast.SymbolFlagsGetAccessor|shimast.SymbolFlagsSetAccessor) != 0:
    return NodeMethod
  case symbol.Flags&shimast.SymbolFlagsVariable != 0:
    return NodeVariable
  default:
    return ""
  }
}
