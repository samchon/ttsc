package graph

import (
  "strings"

  shimast "github.com/microsoft/typescript-go/shim/ast"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// Build walks the program's workspace source files and records a node for
// each top-level declaration. The checker can load a dependency's raw `.ts`
// entry, so IsWorkspaceSourceFile owns the declaration boundary instead of
// assuming every non-declaration source is authored here. External boundary
// leaves enter the graph only as the resolved target of an edge (see Resolve).
//
// @evidence contracts/common.md#principled-implementation Declarations are indexed before checker-resolved relations, so every workspace endpoint uses one Program's symbols and identities.
// @evidence contracts/common.md#clear-and-simple-design The complete build delegates to BuildFiles with nil selection and releases scratch state at one completion boundary.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Compiler APIs determine declarations and relationships; no model-specific source pattern or expected graph answer is substituted.
// @evidence contracts/common.md#meaningful-documentation The native comment identifies the producing Program and complete-build responsibility; separated tags follow the documentation skill.
// @evidence contracts/performance.md#efficient-algorithms Work scales with resident source ASTs, emitted facts and repeated enclosing-container traversals; memoized resolution avoids repeating checker lookups.
// @evidence contracts/performance.md#reuse-equivalent-work Per-build AST resolution, doc-host and edge identity maps share equivalent work only within this immutable Program.
// @evidence contracts/performance.md#bound-retention-and-release-resources The returned graph owns its facts; releaseBuildState drops AST-keyed and base-node scratch maps before the completed generation escapes.
func Build(prog *driver.Program) *Graph {
  return BuildFiles(prog, nil, nil)
}

// BuildFiles resolves graph facts owned by selected source files against one
// immutable Program. A nil selection preserves Build's complete-project
// behavior. A non-nil selection emits only replacement nodes and outgoing
// facts for those files while using baseNodes as a read-only endpoint index.
//
// This is the semantic primitive a resident shard store needs: an ordinary edit
// asks the new checker only about its invalidated closure instead of walking
// every declaration again, while cross-file targets retain the exact stable IDs
// established by the preceding committed generation.
//
// @evidence contracts/common.md#principled-implementation Selected workspace files supply replacement facts while committed base nodes resolve unchanged cross-file endpoints without mutating the previous generation.
// @evidence contracts/common.md#clear-and-simple-design Selection and base-node context extend the same build pipeline instead of a second graph implementation.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The invalidation owner supplies selected paths; no heuristic file quota, cooldown or fixture exception weakens the replacement set.
// @evidence contracts/common.md#meaningful-documentation The native comment states partial ownership and committed endpoint reuse, applying documentation-skill spacing to these acknowledgments.
// @evidence contracts/performance.md#efficient-algorithms File selection is indexed once; declaration and relation walks cover only selected files while base endpoint lookup is constant expected time.
// @evidence contracts/performance.md#reuse-equivalent-work The supplied committed map reuses unchanged endpoints and build-local memoization reuses checker answers within the replacement Program.
// @evidence contracts/performance.md#bound-retention-and-release-resources Base nodes are borrowed during the transaction and released from scratch at completion; only emitted replacement facts remain owned by the returned graph.
func BuildFiles(prog *driver.Program, selected []string, baseNodes map[string]*Node) *Graph {
  selectedFiles := map[string]bool{}
  if selected != nil {
    for _, file := range selected {
      selectedFiles[file] = true
    }
  }
  g := &Graph{
    pathCaseInsensitive:   !prog.TSProgram.UseCaseSensitiveFileNames(),
    Nodes:                 map[string]*Node{},
    bodyNodes:             map[string]bool{},
    seen:                  map[edgeKey]struct{}{},
    resolved:              map[*shimast.Node]*Target{},
    edgeEvidenceFiles:     map[string]string{},
    baseNodes:             baseNodes,
    selectedFiles:         selectedFiles,
    ExportedTargets:       map[string]bool{},
    ImplementationSources: map[string]map[string]bool{},
  }
  for _, file := range prog.SourceFiles() {
    if !IsWorkspaceSourceFile(file) {
      continue
    }
    if selected != nil && !selectedFiles[file.FileName()] {
      continue
    }
    g.putModuleNode(file)
    collectDeclarations(g, file)
  }
  g.addEdges(prog, selectedFiles, selected != nil)
  g.releaseBuildState()
  return g
}

// releaseBuildState drops the scratch the build needed, once the edge pass has
// finished with it.
//
// Every map cleared here is documented build-only, and each holds pointers into
// the compiler AST or into the preceding generation's nodes: resolved is keyed
// by *shimast.Node, docHosts holds one per documented declaration, and baseNodes
// is the whole prior endpoint index. A consumer that retains the returned Graph
// would otherwise pin all of it for as long as it held the graph —
// internal/graphsymbols retains one for the lifetime of an editor session
// between invalidations, closing the Program while the maps that reference its
// AST live on. Clearing them here rather than at that consumer keeps the
// decision with the producer, which is the only side that knows which fields are
// scratch.
//
// ExportedTargets and ImplementationSources are deliberately not cleared: the
// shard expansion path in cmd/ttscgraph/serve_shards.go reads both after this
// returns, and Nodes/Edges/Decorators/DocTags are the graph itself.
func (g *Graph) releaseBuildState() {
  g.docTagPositions = nil
  g.docHosts = nil
  g.docHostPositions = nil
  g.bodyNodes = nil
  g.seen = nil
  g.resolved = nil
  g.edgeEvidenceFiles = nil
  g.baseNodes = nil
  g.selectedFiles = nil
}

// SourceTexts maps every program source to the resident checker text.
// Declaration and virtual bundled files are included because external graph
// leaves still carry facts and spans the source manifest must attest to.
//
// @evidence contracts/common.md#principled-implementation Text comes from resident SourceFiles, including dependencies needed to ground external evidence, rather than a later disk snapshot.
// @evidence contracts/common.md#clear-and-simple-design One map exposes Program-owned text without reimplementing file loading.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No filesystem reread or consumer-specific source substitution can mix source generations.
// @evidence contracts/common.md#meaningful-documentation Native prose describes resident-source completeness and ownership, separated from tags under the documentation skill.
// @evidence contracts/performance.md#efficient-algorithms One pass over loaded files builds a path map; source strings are shared rather than recopied by content.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This extraction does not coordinate repeated requests; its Program owner decides when a generation's text map can be reused.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The caller receives the map and owns its lifetime; this function retains no Program reference after return.
func SourceTexts(prog *driver.Program) map[string]string {
  if prog == nil || prog.TSProgram == nil {
    return map[string]string{}
  }
  // Discarded on purpose: this returns text, not an error channel. A failed
  // apply reaches the dump through `NewDiagnostics`, which asks `Diagnostics`.
  _ = prog.ApplyLinkedPlugins()
  files := prog.TSProgram.SourceFiles()
  out := make(map[string]string, len(files))
  for _, file := range files {
    if file == nil {
      continue
    }
    out[file.FileName()] = file.Text()
  }
  return out
}

// SourceTextsForFiles returns resident checker text only for the named source
// files. It is the partial-build counterpart of SourceTexts: selected graph
// shards still receive exact evidence and signatures, without walking or
// retaining every unchanged source body again.
//
// @evidence contracts/common.md#principled-implementation The selected path set filters resident compiler text, preserving the replacement generation's evidence source without touching disk.
// @evidence contracts/common.md#clear-and-simple-design A selection map adapts SourceTexts' ownership rule for shard producers.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Caller-selected paths determine inclusion; no source content heuristic or diagnostic expectation affects the text.
// @evidence contracts/common.md#meaningful-documentation The native comment explains selected-source coverage and snapshot ownership with documentation-skill paragraph and tag spacing.
// @evidence contracts/performance.md#efficient-algorithms A set costs O(selected paths) and one resident-file pass costs O(loaded files), without repeated selected-path scans.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This function extracts a caller-owned generation view and does not own reuse across requests.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Returned strings and map transfer to the caller; no native handle or retained cache is acquired.
func SourceTextsForFiles(prog *driver.Program, files []string) map[string]string {
  if prog == nil || prog.TSProgram == nil {
    return map[string]string{}
  }
  _ = prog.ApplyLinkedPlugins()
  selected := make(map[string]bool, len(files))
  for _, file := range files {
    selected[file] = true
  }
  out := make(map[string]string, len(files))
  for _, source := range prog.TSProgram.SourceFiles() {
    if source != nil && selected[source.FileName()] {
      out[source.FileName()] = source.Text()
    }
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
      // Much of the ecosystem writes its engine as closures inside a factory
      // (Vue's renderer chain lives inside `baseCreateRenderer`), so skipping
      // them would leave a blank where the flow the index exists to describe
      // sits. A closure ranks below the surface it hangs under and never takes a
      // tour seed; it answers when asked for by name.
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
    g.collectObjectMembers(path, binding)
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
// what a file declares at its top level would leave that code out of the graph
// entirely.
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
// Such a closure stays out of the graph.
//
// @evidence contracts/common.md#principled-implementation Lexical binding and enclosing callable identity distinguish local closures without source offsets or unstable counters.
// @evidence contracts/common.md#clear-and-simple-design Owner and binding helpers compose one declaration identity, returning presence separately from the resulting string.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Compiler AST binding determines supported closures; unnamed callbacks are not fabricated from fixture text.
// @evidence contracts/common.md#meaningful-documentation Native prose states named-local scope and positional stability, following the documentation skill's prose/tag separation.
// @evidence contracts/performance.md#efficient-algorithms Cost follows the enclosing callable chain and constructed name length, not the whole source file.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This identity helper does not coordinate consumers; callers reuse indexed closure nodes within the graph generation.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Only a result string is returned; no AST or cache is retained.
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
//
// @evidence contracts/common.md#principled-implementation The AST walk selects named function-like declarations inside the owning body and stops at each selected closure's boundary.
// @evidence contracts/common.md#clear-and-simple-design One local collector supplies both declaration indexing and relation attribution with the same closure membership.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Native AST kinds and binding syntax determine selection without parsed-text approximations.
// @evidence contracts/common.md#meaningful-documentation The native comment explains body scope and nested-closure ownership, with tags separated under the documentation skill.
// @evidence contracts/performance.md#efficient-algorithms Each AST node in the current owner's body is visited once until a selected closure boundary; output space follows selected closures.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This collection does not own cross-phase caching; Build's immutable AST and indexed nodes establish generation-level reuse.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The result borrows AST pointers and transfers its slice to the caller without retaining a Program.
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
//
// @evidence contracts/common.md#principled-implementation Within the caller's function-body walk, function declarations and variables with callable bodies are the constructs eligible for closure indexing.
// @evidence contracts/common.md#clear-and-simple-design Kind selection and the shared functionBody helper classify one AST node; lexical ownership remains with ClosuresIn.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Closure classification follows AST ownership, not fixture naming or graph ranking requirements.
// @evidence contracts/common.md#meaningful-documentation Native prose defines the nested callable distinction and its use in boundary handling, with documentation-skill spacing.
// @evidence contracts/performance.md#efficient-algorithms Kind dispatch is constant time; a variable's initializer unwrap follows only its local wrapper depth with constant temporary space.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This predicate does not coordinate repeated operations or retain a classification cache.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources No state or native resource is acquired.
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
  // Tags belong to the identity, not to whichever declaration of it wins the
  // display span below. An overload run documented on its first signature and
  // implemented underneath returns early from the node branch, so collecting
  // there would drop exactly the declaration authors write documentation on.
  collectDocTags(g, id, declaration)
  hasBody := declarationHasImplementation(declaration, kind)
  if _, exists := g.Nodes[id]; exists {
    if !hasBody || g.bodyNodes[id] {
      return
    }
  }
  g.Nodes[id] = &Node{
    ID:           id,
    Name:         name,
    Simple:       simpleName(declaration.Symbol()),
    HasSimple:    declaration.Symbol() != nil,
    Kind:         kind,
    File:         path,
    Pos:          declaration.Pos(),
    End:          declaration.End(),
    SignatureEnd: declarationSignatureEnd(declaration),
    Modifiers:    declarationModifiers(declaration),
  }
  g.bodyNodes[id] = hasBody
}

// declarationSignatureEnd is the offset where a declaration's head ends, or 0
// when this declaration has no body to bound.
//
// It reuses the boundary walk the object-member outline already uses, which
// stops at the construct that opens a body — a block, an object or array
// literal, a class expression, or an arrow's `=>`. Reusing it keeps one
// definition of "where the head ends" for both outlines rather than two that
// can disagree.
//
// A boundary at or before the declaration's own start, or past its end, is no
// boundary; those report 0 and leave the consumer on its existing behavior.
func declarationSignatureEnd(declaration *shimast.Node) int {
  if declaration == nil {
    return 0
  }
  boundary, found := sourceBodyBoundary(declaration)
  if !found || boundary.end <= declaration.Pos() || boundary.end > declaration.End() {
    return 0
  }
  return boundary.end
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
  if symbol == nil || symbol.Parent == nil || symbol.Parent.Name == "" {
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
// `__#41@#field` in one run and `__#38@#field` in the next. Left in the node id
// that counter would reach the wire: the same unedited source would produce
// different identities in two dumps, a handle given out in one session would
// name nothing after a restart, and no two dumps could be compared to prove a
// change had left the facts alone.
//
// The number identifies nothing a reader can use — the class already
// distinguishes the field, and `#field` is what the source calls it. Dropping it
// keeps the id a function of the code.
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
  if symbol == nil {
    return ""
  }
  name := simpleName(symbol)
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
