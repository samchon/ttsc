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
    seen:      map[edgeKey]struct{}{},
    resolved:  map[*shimast.Node]*Target{},
  }
  for _, file := range prog.SourceFiles() {
    g.putModuleNode(file)
    collectDeclarations(g, file)
  }
  g.addEdges(prog)
  return g
}

// SourceTexts maps each program source file to its text — the evidence input
// NewDump needs to turn a node or edge byte span into a line/column.
func SourceTexts(prog *driver.Program) map[string]string {
  files := prog.SourceFiles()
  out := make(map[string]string, len(files))
  for _, file := range files {
    out[file.FileName()] = file.Text()
  }
  return out
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
      // A function declared inside a function is still a name the runtime calls.
      // This was off for a while on the theory that a closure is implementation,
      // and implementation is read from the file — but Vue's renderer chain lives
      // inside `baseCreateRenderer`, so `patch`, `mountElement` and
      // `setupRenderEffect` were not implementation detail the index could skip;
      // they were the flow the index exists to describe, and the graph had a blank
      // where they belong. Asked how a state change reaches the DOM, a model spent
      // three calls hunting for a name the graph did not hold.
      //
      // The cost is small and the answer is not bigger: the graph grows 3% in
      // nodes on Vue and 5% on VS Code, and the tour payload does not change by a
      // byte, because a closure ranks below the surface it hangs under and never
      // takes a seed. It answers when asked for by name. Measured on the
      // specific-flow lane: 59% of baseline tokens saved to 82%, and the calls
      // halve — TypeORM 5 to 1, VS Code 8 to 2, Vue 6 to 2.
      //
      // The bodies stay out. A closure is a node with edges, not source text.
      collectClosures(g, path, statement)
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
// variable statement (both bindings of `const a = 1, b = 2`), then the functions
// declared inside a binding that holds one.
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
    collectClosures(g, path, binding)
  }
}

// collectClosures records a node for each function a declaration's body declares,
// and for the functions those declare in turn.
//
// A factory that closes over its state and returns local functions is how much of
// the ecosystem writes its engine: Vue's `patch`, `mountElement`, and
// `setupRenderEffect` are locals of `baseCreateRenderer`; a curried validator's
// real parse is a local of the function that binds its error class. Recording only
// what a file declares at its top level left that code out of the graph entirely —
// a model asking how a state change reaches the DOM found the factory, nothing
// under it, and went to read the files.
//
// Only functions are recorded. A local `const i = 0` is a value, not a place code
// runs, and the graph would drown in them.
func collectClosures(g *Graph, path string, declaration *shimast.Node) {
  for _, closure := range ClosuresIn(declaration) {
    name, ok := ClosureName(closure)
    if !ok {
      continue
    }
    kind := NodeFunction
    if closure.Kind == shimast.KindVariableDeclaration {
      kind = NodeVariable
    }
    putDeclaredNode(g, path, name, kind, closure)
    if node, ok := g.Nodes[nodeID(path, name, kind)]; ok {
      node.Closure = true
    }
    collectClosures(g, path, closure)
  }
}

// ClosureName returns the name a closure is recorded under — its own name behind
// the names of the functions it is nested in, so `baseCreateRenderer.patch` and
// another file-mate's `patch` are two nodes rather than one merged phantom.
//
// It reports false when any enclosing function is anonymous. An `inner` declared
// inside two different callbacks of one file would otherwise key the same id and
// merge into a node that is neither, fabricating edges between unrelated scopes.
// Such a closure stays out of the graph, exactly as every body-scoped declaration
// did before.
func ClosureName(closure *shimast.Node) (string, bool) {
  symbol := closure.Symbol()
  if symbol == nil {
    return "", false
  }
  name := qualifiedName(symbol)
  if name == "" {
    return "", false
  }
  for parent := closure.Parent; parent != nil; parent = parent.Parent {
    if parent.Kind == shimast.KindSourceFile {
      break
    }
    if !isFunctionLike(parent) {
      continue
    }
    owner, ok := ownerName(parent)
    if !ok {
      return "", false
    }
    name = owner + "." + name
  }
  return name, true
}

// isFunctionLike reports whether a node is a function whose body is a scope. A
// variable that binds one is not: the function it holds is a node of this chain
// already, and counting both would name a closure after its owner twice.
func isFunctionLike(node *shimast.Node) bool {
  switch node.Kind {
  case shimast.KindFunctionDeclaration,
    shimast.KindFunctionExpression,
    shimast.KindArrowFunction,
    shimast.KindMethodDeclaration,
    shimast.KindConstructor,
    shimast.KindGetAccessor,
    shimast.KindSetAccessor:
    return true
  }
  return false
}

// ownerName returns the name of a function-like declaration a closure sits in: a
// function or method by its own (class-qualified) name, a function expression or
// arrow by the variable that binds it. It reports false for an anonymous one.
func ownerName(declaration *shimast.Node) (string, bool) {
  switch declaration.Kind {
  case shimast.KindFunctionExpression, shimast.KindArrowFunction:
    binding := bindingOf(declaration)
    if binding == nil {
      return "", false
    }
    declaration = binding
  }
  symbol := declaration.Symbol()
  if symbol == nil {
    return "", false
  }
  name := qualifiedName(symbol)
  if name == "" {
    return "", false
  }
  return name, true
}

// bindingOf returns the variable declaration a function expression is bound to,
// seeing through the wrappers a codebase writes around one, or nil when the
// function is anonymous.
func bindingOf(fn *shimast.Node) *shimast.Node {
  for parent := fn.Parent; parent != nil; parent = parent.Parent {
    switch parent.Kind {
    case shimast.KindVariableDeclaration:
      return parent
    case shimast.KindAsExpression,
      shimast.KindSatisfiesExpression,
      shimast.KindParenthesizedExpression:
      continue
    default:
      return nil
    }
  }
  return nil
}

// ClosuresIn returns the functions a declaration's body declares — a nested
// function declaration, or a binding that holds a function — found however deep
// in the body's statements they sit (inside an `if`, a `try`, a loop), but not
// past one: a closure's own closures belong to it, and the caller recurses.
//
// A binding that holds no function is not one. A local `const i = 0` is a value,
// not a place code runs.
func ClosuresIn(declaration *shimast.Node) []*shimast.Node {
  body := functionBody(declaration)
  if body == nil {
    return nil
  }
  var closures []*shimast.Node
  var walk func(node *shimast.Node)
  walk = func(node *shimast.Node) {
    node.ForEachChild(func(child *shimast.Node) bool {
      if IsClosure(child) {
        closures = append(closures, child)
        return false
      }
      walk(child)
      return false
    })
  }
  walk(body)
  return closures
}

// IsClosure reports whether a node inside a function body is a function the graph
// records: a nested function declaration, or a binding that holds a function.
func IsClosure(node *shimast.Node) bool {
  switch node.Kind {
  case shimast.KindFunctionDeclaration:
    return true
  case shimast.KindVariableDeclaration:
    return functionBody(node) != nil
  }
  return false
}

// functionBody returns the block body of any function-like declaration — a
// function, a method, an accessor, a constructor, or a function/arrow expression
// a variable binds.
func functionBody(declaration *shimast.Node) *shimast.Node {
  switch declaration.Kind {
  case shimast.KindFunctionDeclaration:
    if fn := declaration.AsFunctionDeclaration(); fn != nil {
      return fn.Body
    }
  case shimast.KindFunctionExpression:
    if fn := declaration.AsFunctionExpression(); fn != nil {
      return fn.Body
    }
  case shimast.KindArrowFunction:
    if fn := declaration.AsArrowFunction(); fn != nil {
      return fn.Body
    }
  case shimast.KindMethodDeclaration:
    if fn := declaration.AsMethodDeclaration(); fn != nil {
      return fn.Body
    }
  case shimast.KindConstructor:
    if fn := declaration.AsConstructorDeclaration(); fn != nil {
      return fn.Body
    }
  case shimast.KindGetAccessor:
    if fn := declaration.AsGetAccessorDeclaration(); fn != nil {
      return fn.Body
    }
  case shimast.KindSetAccessor:
    if fn := declaration.AsSetAccessorDeclaration(); fn != nil {
      return fn.Body
    }
  case shimast.KindVariableDeclaration:
    if binding := declaration.AsVariableDeclaration(); binding != nil {
      return functionBodyOfInitializer(binding.Initializer)
    }
  }
  return nil
}

// functionBodyOfInitializer unwraps a binding's initializer to the body of the
// function it holds, seeing through the `as const` / satisfies wrappers a
// codebase writes around one.
func functionBodyOfInitializer(initializer *shimast.Node) *shimast.Node {
  for initializer != nil {
    switch initializer.Kind {
    case shimast.KindFunctionExpression, shimast.KindArrowFunction:
      return functionBody(initializer)
    case shimast.KindAsExpression:
      as := initializer.AsAsExpression()
      if as == nil {
        return nil
      }
      initializer = as.Expression
    case shimast.KindSatisfiesExpression:
      satisfies := initializer.AsSatisfiesExpression()
      if satisfies == nil {
        return nil
      }
      initializer = satisfies.Expression
    case shimast.KindParenthesizedExpression:
      parenthesized := initializer.AsParenthesizedExpression()
      if parenthesized == nil {
        return nil
      }
      initializer = parenthesized.Expression
    default:
      return nil
    }
  }
  return nil
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
    collectClosures(g, path, member)
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
    ID:        id,
    Name:      name,
    Simple:    simpleName(declaration.Symbol()),
    Kind:      kind,
    File:      path,
    Pos:       declaration.Pos(),
    End:       declaration.End(),
    Modifiers: declarationModifiers(declaration),
  }
  g.bodyNodes[id] = hasBody
}

// declarationModifiers maps a declaration's combined modifier flags onto the
// wire-string subset of the TtscGraphNodeModifier union. Only flags with an
// exact union member are emitted, in a stable order; an unknown string would
// break the TypeScript-side typia.assert on the dump. It returns nil when the
// declaration carries no recorded modifier.
func declarationModifiers(declaration *shimast.Node) []string {
  flags := shimast.GetCombinedModifierFlags(declaration)
  if flags == shimast.ModifierFlagsNone {
    return nil
  }
  var modifiers []string
  for _, m := range modifierFlagStrings {
    if flags&m.flag != 0 {
      modifiers = append(modifiers, m.text)
    }
  }
  return modifiers
}

// modifierFlagStrings is the ordered flag-to-wire-string table
// declarationModifiers walks. The order fixes the emitted sequence so a dump is
// deterministic; ModifierFlagsAmbient is the `declare` keyword.
var modifierFlagStrings = []struct {
  flag shimast.ModifierFlags
  text string
}{
  {shimast.ModifierFlagsExport, "export"},
  {shimast.ModifierFlagsDefault, "default"},
  {shimast.ModifierFlagsAmbient, "declare"},
  {shimast.ModifierFlagsAbstract, "abstract"},
  {shimast.ModifierFlagsStatic, "static"},
  {shimast.ModifierFlagsReadonly, "readonly"},
  {shimast.ModifierFlagsAsync, "async"},
  {shimast.ModifierFlagsConst, "const"},
  {shimast.ModifierFlagsPublic, "public"},
  {shimast.ModifierFlagsPrivate, "private"},
  {shimast.ModifierFlagsProtected, "protected"},
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

// simpleName is the unqualified declared name of a symbol with no owner prefix,
// the same form qualifiedName uses for the trailing member. A constructor's
// internal-name prefix (\xFE) is escaped to "__" so the two agree.
func simpleName(symbol *shimast.Symbol) string {
  if symbol == nil || symbol.Name == "" {
    return ""
  }
  return stripPrivateMangling(strings.ReplaceAll(symbol.Name, "\xFE", "__"))
}

// stripPrivateMangling removes the checker's per-run counter from the name of a
// private class member.
//
// A `#field` is bound under a mangled name — `__#41@#field` — whose number comes
// from a counter that advances as the program is bound, so the same field is
// `__#41@#field` in one run and `__#38@#field` in the next. That counter reached
// the node id, and with it the wire: on VS Code, 661 nodes and 661 edges changed
// identity between two dumps of the *same unedited source*. A handle the model
// was given could name nothing after a restart, and no dump could be compared to
// another to prove a change had left the facts alone.
//
// The number identifies nothing a reader can use — the class already
// distinguishes the field, and `#field` is what the source calls it. Dropping it
// makes the id a function of the code again.
func stripPrivateMangling(name string) string {
  const prefix = "__#"
  start := strings.Index(name, prefix)
  if start == -1 {
    return name
  }
  rest := name[start+len(prefix):]
  at := strings.IndexByte(rest, '@')
  if at <= 0 {
    return name
  }
  for _, char := range rest[:at] {
    if char < '0' || char > '9' {
      return name
    }
  }
  return name[:start] + rest[at+1:]
}

// qualifiedName is the identity name of a symbol: its own name, prefixed by the
// dotted chain of every enclosing namespace and declaring class or interface. A
// declaration at a module's top level has no such container, so its name is
// returned unchanged, which keeps every existing top-level node id stable. A
// constructor's internal-name prefix (\xFE) is escaped to "__".
func qualifiedName(symbol *shimast.Symbol) string {
  name := simpleName(symbol)
  if name == "" {
    return ""
  }
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
