// unicorn/consistent-function-scoping reports nested function definitions that
// can move to an outer scope without losing a captured binding. TypeScript
// checker symbols preserve binding identity through shadowing, destructuring,
// imports, JSX, and declaration merging; source spelling is never used as a
// substitute for scope analysis.
//
// The surrounding-scope calculation mirrors the upstream rule's meaningful
// exceptions. Loop header and body scopes are considered together, returned
// arrow chains are checked from the returner's scope, and immediate children
// of React hooks and IIFEs are left in place. Jest mock factories are excluded
// at every depth because Jest forbids their out-of-scope references.
//
// Two deliberate deviations extend upstream, both demanded by the issue
// contract and both conservative (they only suppress reports):
//   - Arrow functions that capture lexical super or `arguments` are immovable
//     alongside upstream's lexical-this check, and private-name uses pin any
//     candidate; the constructs cannot survive relocation.
//   - The block a function is defined in always joins the pin set, not only
//     when it chains up to a loop body: a binding declared beside the
//     function would go out of scope if the function moved.
//
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/rules/consistent-function-scoping.js
package linthost

import (
  "bytes"
  "encoding/json"
  "fmt"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimscanner "github.com/microsoft/typescript-go/shim/scanner"
)

type unicornConsistentFunctionScoping struct{}

type unicornConsistentFunctionScopingOptions struct {
  checkArrowFunctions bool
}

type unicornConsistentFunctionScopingAnalysis struct {
  ctx                *Context
  referencesBySymbol map[*shimast.Symbol][]*shimast.Node
  unresolvedPrivate  []*shimast.Node
}

type unicornConsistentFunctionScopingScopeSet struct {
  owners map[*shimast.Node]struct{}
  main   *shimast.Node
}

func (unicornConsistentFunctionScoping) Name() string {
  return "unicorn/consistent-function-scoping"
}

func (unicornConsistentFunctionScoping) NeedsTypeChecker() bool { return true }

func (unicornConsistentFunctionScoping) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindSourceFile}
}

func (unicornConsistentFunctionScoping) ValidateOptions(raw json.RawMessage) error {
  _, err := decodeUnicornConsistentFunctionScopingOptions(raw)
  return err
}

func (unicornConsistentFunctionScoping) Check(ctx *Context, node *shimast.Node) {
  if ctx == nil || ctx.File == nil || ctx.Checker == nil || node == nil {
    return
  }
  options, err := decodeUnicornConsistentFunctionScopingOptions(ctx.Options)
  if err != nil {
    return
  }

  analysis := newUnicornConsistentFunctionScopingAnalysis(ctx, node)
  walkDescendants(node, func(function *shimast.Node) {
    if !unicornConsistentFunctionScopingIsCandidate(function) ||
      (function.Kind == shimast.KindArrowFunction && !options.checkArrowFunctions) {
      return
    }
    scopes, ok := unicornConsistentFunctionScopingParentScopes(function)
    if !ok || scopes.containsKind(shimast.KindSourceFile) ||
      unicornConsistentFunctionScopingInsideJestMockFactory(function) ||
      unicornConsistentFunctionScopingIsReactHookScope(scopes.main) ||
      unicornConsistentFunctionScopingIsIIFE(scopes.main) ||
      analysis.capturesParentScope(function, scopes) {
      return
    }

    start, end := unicornConsistentFunctionScopingReportRange(ctx.File, function)
    if start < 0 || end < start {
      ctx.Report(function, unicornConsistentFunctionScopingMessage(function))
      return
    }
    ctx.ReportRange(start, end, unicornConsistentFunctionScopingMessage(function))
  })
}

func decodeUnicornConsistentFunctionScopingOptions(
  raw json.RawMessage,
) (unicornConsistentFunctionScopingOptions, error) {
  options := unicornConsistentFunctionScopingOptions{checkArrowFunctions: true}
  trimmed := bytes.TrimSpace(raw)
  if len(trimmed) == 0 {
    return options, nil
  }
  if trimmed[0] != '{' {
    return options, fmt.Errorf("options must be an object")
  }

  var fields map[string]json.RawMessage
  if err := json.Unmarshal(trimmed, &fields); err != nil || fields == nil {
    if err == nil {
      err = fmt.Errorf("null object")
    }
    return options, fmt.Errorf("options must be an object: %w", err)
  }
  for name := range fields {
    if name != "checkArrowFunctions" {
      return options, fmt.Errorf("unknown option %q", name)
    }
  }
  if value, exists := fields["checkArrowFunctions"]; exists {
    if bytes.Equal(bytes.TrimSpace(value), []byte("null")) ||
      json.Unmarshal(value, &options.checkArrowFunctions) != nil {
      return options, fmt.Errorf("option %q must be a boolean", "checkArrowFunctions")
    }
  }
  return options, nil
}

func newUnicornConsistentFunctionScopingAnalysis(
  ctx *Context,
  source *shimast.Node,
) *unicornConsistentFunctionScopingAnalysis {
  analysis := &unicornConsistentFunctionScopingAnalysis{
    ctx:                ctx,
    referencesBySymbol: make(map[*shimast.Symbol][]*shimast.Node),
  }
  walkDescendants(source, func(node *shimast.Node) {
    if !analysis.isReference(node) {
      return
    }
    symbol := unicornConsistentFunctionScopingSymbol(ctx, node)
    if symbol == nil {
      if node.Kind == shimast.KindPrivateIdentifier {
        analysis.unresolvedPrivate = append(analysis.unresolvedPrivate, node)
      }
      return
    }
    if unicornConsistentFunctionScopingIsImplicitArguments(node, symbol) ||
      unicornConsistentFunctionScopingIsDeclarationName(node, symbol) {
      return
    }
    analysis.referencesBySymbol[symbol] = append(analysis.referencesBySymbol[symbol], node)
  })
  return analysis
}

// The checker resolves every plain `arguments` reference to one shared
// implicit symbol without declarations, so the grouped reference map would
// fuse unrelated functions' `arguments` objects into a single binding and
// let a parent's own `arguments` pin a nested function. Each non-arrow
// function rebinds `arguments`; only the arrow lexical-environment check may
// treat the implicit symbol as a capture.
func unicornConsistentFunctionScopingIsImplicitArguments(
  node *shimast.Node,
  symbol *shimast.Symbol,
) bool {
  return node.Kind == shimast.KindIdentifier && identifierText(node) == "arguments" &&
    symbol.ValueDeclaration == nil && len(symbol.Declarations) == 0
}

func (analysis *unicornConsistentFunctionScopingAnalysis) isReference(node *shimast.Node) bool {
  if node == nil {
    return false
  }
  switch node.Kind {
  case shimast.KindPrivateIdentifier:
    return !unicornConsistentFunctionScopingIsPrivateDeclaration(node)
  case shimast.KindIdentifier:
  default:
    return false
  }
  if !unicornConsistentFunctionScopingIsSemanticReferenceIdentifier(node) {
    return false
  }
  if parent := node.Parent; parent != nil && parent.Kind == shimast.KindBindingElement {
    binding := parent.AsBindingElement()
    if binding != nil && binding.PropertyName == node {
      return false
    }
  }
  return true
}

// TypeScript's scope manager treats type-space dependencies as references too:
// moving a function past a local type alias or namespace would still break the
// program even though the reference erases at runtime. The shared value helper
// already handles qualified-name property slots; only a simple TypeReference's
// TypeName needs to be admitted explicitly.
func unicornConsistentFunctionScopingIsSemanticReferenceIdentifier(node *shimast.Node) bool {
  if node == nil || node.Parent == nil {
    return node != nil
  }
  parent := node.Parent
  switch parent.Kind {
  case shimast.KindJsxOpeningElement,
    shimast.KindJsxSelfClosingElement,
    shimast.KindJsxClosingElement:
    if parent.TagName() == node && shimscanner.IsIntrinsicJsxName(identifierText(node)) {
      return false
    }
  case shimast.KindJsxAttribute,
    shimast.KindNamedTupleMember,
    shimast.KindImportAttribute,
    shimast.KindNamespaceExport,
    shimast.KindNamespaceExportDeclaration,
    shimast.KindMetaProperty:
    if parent.Name() == node {
      return false
    }
  case shimast.KindJsxNamespacedName:
    return false
  }
  if isValueReferenceIdentifier(node) {
    return true
  }
  if parent.Kind != shimast.KindTypeReference {
    return false
  }
  reference := parent.AsTypeReferenceNode()
  return reference != nil && reference.TypeName == node
}

// Checker symbols are the complete declaration oracle. Comparing against
// their declaration-name nodes avoids maintaining a brittle syntax-kind list
// while keeping JSX component tag uses distinct from the declarations they
// resolve to.
func unicornConsistentFunctionScopingIsDeclarationName(
  node *shimast.Node,
  symbol *shimast.Symbol,
) bool {
  if node == nil || symbol == nil {
    return false
  }
  if declaration := symbol.ValueDeclaration; declaration != nil && declaration.Name() == node {
    return true
  }
  for _, declaration := range symbol.Declarations {
    if declaration != nil && declaration.Name() == node {
      return true
    }
  }
  return false
}

func unicornConsistentFunctionScopingIsPrivateDeclaration(node *shimast.Node) bool {
  if node == nil || node.Kind != shimast.KindPrivateIdentifier || node.Parent == nil {
    return false
  }
  switch node.Parent.Kind {
  case shimast.KindPropertyDeclaration,
    shimast.KindMethodDeclaration,
    shimast.KindGetAccessor,
    shimast.KindSetAccessor:
    return node.Parent.Name() == node
  }
  return false
}

func unicornConsistentFunctionScopingSymbol(ctx *Context, node *shimast.Node) *shimast.Symbol {
  if ctx == nil || ctx.Checker == nil || node == nil {
    return nil
  }
  if node.Kind == shimast.KindIdentifier {
    return canonicalValueSymbol(ctx, node)
  }
  symbol := ctx.Checker.GetSymbolAtLocation(node)
  if symbol == nil {
    return nil
  }
  return ctx.Checker.GetMergedSymbol(symbol)
}

func (analysis *unicornConsistentFunctionScopingAnalysis) capturesParentScope(
  function *shimast.Node,
  scopes unicornConsistentFunctionScopingScopeSet,
) bool {
  if function.Kind == shimast.KindArrowFunction &&
    analysis.arrowCapturesLexicalEnvironment(function) {
    return true
  }
  for _, private := range analysis.unresolvedPrivate {
    if noLoopFuncNodeContains(function, private) {
      return true
    }
  }

  for symbol, references := range analysis.referencesBySymbol {
    usedInside := false
    privateReference := false
    for _, reference := range references {
      if noLoopFuncNodeContains(function, reference) {
        usedInside = true
        privateReference = privateReference || reference.Kind == shimast.KindPrivateIdentifier
      }
    }
    if !usedInside {
      continue
    }

    // Upstream keeps a nested function beside direct uses of the same binding
    // in the surrounding scope, and it applies this check before the
    // recursive-name exemption, so an outer call of a self-recursive function
    // pins it in place. Require an exact scope owner so a sibling closure
    // does not masquerade as its parent.
    for _, reference := range references {
      if noLoopFuncNodeContains(function, reference) {
        continue
      }
      if scopes.contains(unicornConsistentFunctionScopingScopeOwner(reference)) {
        return true
      }
    }
    if unicornConsistentFunctionScopingSymbolDeclaredInside(symbol, function) {
      continue
    }
    if privateReference || unicornConsistentFunctionScopingSymbolDeclaredInScopes(symbol, scopes) {
      return true
    }
  }
  return false
}

func unicornConsistentFunctionScopingSymbolDeclaredInside(
  symbol *shimast.Symbol,
  function *shimast.Node,
) bool {
  if symbol == nil || function == nil {
    return false
  }
  if symbol.ValueDeclaration != nil && noLoopFuncNodeContains(function, symbol.ValueDeclaration) {
    return true
  }
  for _, declaration := range symbol.Declarations {
    if declaration != nil && noLoopFuncNodeContains(function, declaration) {
      return true
    }
  }
  return false
}

func unicornConsistentFunctionScopingSymbolDeclaredInScopes(
  symbol *shimast.Symbol,
  scopes unicornConsistentFunctionScopingScopeSet,
) bool {
  if symbol == nil {
    return false
  }
  if unicornConsistentFunctionScopingDeclarationPins(symbol.ValueDeclaration, scopes) {
    return true
  }
  for _, declaration := range symbol.Declarations {
    if unicornConsistentFunctionScopingDeclarationPins(declaration, scopes) {
      return true
    }
  }
  return false
}

// declarationPins mirrors two upstream checks at once: `resolved.scope` in
// the parent scopes (a binding declared beside the function) and
// `scopeManager.acquire(definition.node)` in the parent scopes (a function
// whose own scope IS a parent scope, i.e. the name of the function the
// candidate is nested in).
func unicornConsistentFunctionScopingDeclarationPins(
  declaration *shimast.Node,
  scopes unicornConsistentFunctionScopingScopeSet,
) bool {
  if declaration == nil {
    return false
  }
  return scopes.contains(declaration) ||
    scopes.contains(unicornConsistentFunctionScopingDeclarationScope(declaration))
}

func unicornConsistentFunctionScopingDeclarationScope(declaration *shimast.Node) *shimast.Node {
  if declaration == nil {
    return nil
  }
  switch declaration.Kind {
  case shimast.KindFunctionDeclaration,
    shimast.KindClassDeclaration,
    shimast.KindTypeAliasDeclaration,
    shimast.KindInterfaceDeclaration,
    shimast.KindEnumDeclaration,
    shimast.KindModuleDeclaration:
    // These declarations open their own scope; the binding they introduce
    // lives in the surrounding one.
    return unicornConsistentFunctionScopingScopeOwner(declaration.Parent)
  }
  if root := unicornConsistentFunctionScopingRootVariableDeclaration(declaration); root != nil &&
    shimast.GetCombinedNodeFlags(root)&shimast.NodeFlagsBlockScoped == 0 {
    return unicornConsistentFunctionScopingVarScope(root)
  }
  return unicornConsistentFunctionScopingScopeOwner(declaration)
}

// rootVariableDeclaration resolves destructuring binding elements to the
// variable declaration that owns them; parameter destructuring yields nil so
// the caller falls back to the syntactic scope walk.
func unicornConsistentFunctionScopingRootVariableDeclaration(node *shimast.Node) *shimast.Node {
  for node != nil && node.Kind == shimast.KindBindingElement {
    if node.Parent == nil {
      return nil
    }
    node = node.Parent.Parent
  }
  if node == nil || node.Kind != shimast.KindVariableDeclaration {
    return nil
  }
  return node
}

// varScope returns the binding scope of a `var` declaration: the nearest
// enclosing function, class static block, namespace body, or source file.
// eslint-scope resolves such bindings to the hoisted home even when the
// declaration is written inside a nested block, so the pin comparison must
// not use the syntactic position.
func unicornConsistentFunctionScopingVarScope(declaration *shimast.Node) *shimast.Node {
  for ancestor := declaration.Parent; ancestor != nil; ancestor = ancestor.Parent {
    if isFunctionLikeKind(ancestor) {
      return ancestor
    }
    switch ancestor.Kind {
    case shimast.KindClassStaticBlockDeclaration,
      shimast.KindModuleBlock,
      shimast.KindSourceFile:
      return ancestor
    }
  }
  return nil
}

// arrowCapturesLexicalEnvironment ports upstream's isNodeContainsLexicalThis
// descent, extended to super and the implicit arguments object per the issue
// contract. The walk covers the arrow's parameters and body, descends through
// nested arrows (which share the lexical environment), stops at non-arrow
// functions and class bodies (which rebind this/arguments and scope super to
// their own methods), and still inspects the head positions that evaluate in
// the enclosing environment: computed member keys, heritage expressions, and
// (deviation, conservative) decorators.
func (analysis *unicornConsistentFunctionScopingAnalysis) arrowCapturesLexicalEnvironment(
  arrow *shimast.Node,
) bool {
  walker := unicornConsistentFunctionScopingLexicalWalker{analysis: analysis}
  walker.childCB = walker.visit
  arrow.ForEachChild(walker.childCB)
  return walker.captured
}

type unicornConsistentFunctionScopingLexicalWalker struct {
  analysis *unicornConsistentFunctionScopingAnalysis
  captured bool
  childCB  func(*shimast.Node) bool
}

// visit returns true (aborting ForEachChild) once a capture is found.
func (walker *unicornConsistentFunctionScopingLexicalWalker) visit(node *shimast.Node) bool {
  if walker.captured {
    return true
  }
  if node == nil {
    return false
  }
  switch node.Kind {
  case shimast.KindThisKeyword, shimast.KindSuperKeyword:
    walker.captured = true
  case shimast.KindIdentifier:
    walker.captured = walker.analysis.isImplicitArgumentsReference(node)
  case shimast.KindClassDeclaration, shimast.KindClassExpression:
    walker.visitClassOuterPositions(node)
  default:
    if isFunctionLikeKind(node) && node.Kind != shimast.KindArrowFunction {
      walker.visitFunctionHeadPositions(node)
      break
    }
    node.ForEachChild(walker.childCB)
  }
  return walker.captured
}

// visitFunctionHeadPositions inspects the pieces of a non-arrow function that
// still evaluate in the enclosing lexical environment: a computed member key
// and any decorators (own or parameter), which run at class-definition time.
// Everything else inside the function rebinds this, super, and arguments.
func (walker *unicornConsistentFunctionScopingLexicalWalker) visitFunctionHeadPositions(
  function *shimast.Node,
) {
  if name := function.Name(); name != nil && name.Kind == shimast.KindComputedPropertyName {
    walker.visit(name)
  }
  walker.visitDecorators(function)
  for _, parameter := range function.Parameters() {
    walker.visitDecorators(parameter)
  }
}

// visitClassOuterPositions mirrors the upstream class case: heritage
// expressions and computed member keys evaluate in the enclosing lexical
// environment, while member bodies, field initializers, and static blocks
// rebind it. Decorators join as a conservative deviation because legacy
// TypeScript decorators also evaluate beside the class definition.
func (walker *unicornConsistentFunctionScopingLexicalWalker) visitClassOuterPositions(
  class *shimast.Node,
) {
  walker.visitDecorators(class)
  if data := class.ClassLikeData(); data != nil && data.HeritageClauses != nil {
    for _, clause := range data.HeritageClauses.Nodes {
      if walker.visit(clause) {
        return
      }
    }
  }
  for _, member := range class.Members() {
    if walker.captured {
      return
    }
    if name := member.Name(); name != nil && name.Kind == shimast.KindComputedPropertyName {
      walker.visit(name)
    }
    walker.visitDecorators(member)
    if isFunctionLikeKind(member) {
      for _, parameter := range member.Parameters() {
        walker.visitDecorators(parameter)
      }
    }
  }
}

func (walker *unicornConsistentFunctionScopingLexicalWalker) visitDecorators(
  node *shimast.Node,
) {
  modifiers := node.Modifiers()
  if modifiers == nil {
    return
  }
  for _, modifier := range modifiers.Nodes {
    if walker.captured {
      return
    }
    if modifier != nil && modifier.Kind == shimast.KindDecorator {
      walker.visit(modifier)
    }
  }
}

// The checker resolves plain arguments references to one shared implicit
// symbol; inside the descent no non-arrow function boundary has been
// crossed, so such a reference reads the enclosing function's arguments
// object. User-declared bindings named arguments stay with the ordinary
// reference analysis instead.
func (analysis *unicornConsistentFunctionScopingAnalysis) isImplicitArgumentsReference(
  node *shimast.Node,
) bool {
  if identifierText(node) != "arguments" || !analysis.isReference(node) {
    return false
  }
  symbol := unicornConsistentFunctionScopingSymbol(analysis.ctx, node)
  return symbol == nil || unicornConsistentFunctionScopingIsImplicitArguments(node, symbol)
}

func unicornConsistentFunctionScopingIsCandidate(node *shimast.Node) bool {
  if node == nil {
    return false
  }
  switch node.Kind {
  case shimast.KindFunctionDeclaration, shimast.KindFunctionExpression, shimast.KindArrowFunction:
    return true
  }
  return false
}

func unicornConsistentFunctionScopingParentScopes(
  function *shimast.Node,
) (unicornConsistentFunctionScopingScopeSet, bool) {
  parent, block := unicornConsistentFunctionScopingDefinitionParent(function)
  main := unicornConsistentFunctionScopingAcquiredScope(parent)
  chain := unicornConsistentFunctionScopingLoopScopeChain(block)
  // Upstream proceeds when either the acquired parent scope or the loop-body
  // chain contributes a scope (a while/do body has no acquirable statement
  // scope but its block still counts); with neither, the function stays
  // unchecked.
  if main == nil && len(chain) == 0 {
    return unicornConsistentFunctionScopingScopeSet{}, false
  }

  scopes := unicornConsistentFunctionScopingScopeSet{
    owners: make(map[*shimast.Node]struct{}),
    main:   main,
  }
  scopes.add(main)
  for _, owner := range chain {
    scopes.add(owner)
  }
  if block != nil {
    // Deviation from upstream: the definition block always joins the pin
    // set, not only through the loop-body chain (see the package comment).
    scopes.add(unicornConsistentFunctionScopingScopeIdentity(block))
  }
  return scopes, true
}

func unicornConsistentFunctionScopingDefinitionParent(
  function *shimast.Node,
) (*shimast.Node, *shimast.Node) {
  expression := unicornConsistentFunctionScopingOuterExpression(function)
  parent := expression.Parent
  if parent == nil {
    return nil, nil
  }

  if function.Kind == shimast.KindArrowFunction && parent.Kind == shimast.KindArrowFunction {
    directParent := parent
    chain := parent
    for {
      outer := unicornConsistentFunctionScopingOuterExpression(chain)
      next := outer.Parent
      if next == nil || next.Kind != shimast.KindArrowFunction {
        parent = directParent
        if next != nil && next.Kind == shimast.KindReturnStatement {
          parent = next.Parent
        }
        break
      }
      chain = next
    }
  } else if parent.Kind == shimast.KindVariableDeclaration {
    declaration := parent.AsVariableDeclaration()
    if declaration == nil || declaration.Initializer != expression {
      return nil, nil
    }
    parent = parent.Parent
    if parent != nil && parent.Kind == shimast.KindVariableDeclarationList {
      parent = parent.Parent
    }
    if parent != nil && parent.Kind == shimast.KindVariableStatement {
      parent = parent.Parent
    }
  } else if function.Kind == shimast.KindArrowFunction && parent.Kind == shimast.KindReturnStatement {
    statement := parent.AsReturnStatement()
    if statement == nil || statement.Expression != expression {
      return nil, nil
    }
    parent = parent.Parent
  }

  var block *shimast.Node
  if parent != nil && parent.Kind == shimast.KindBlock {
    block = parent
    parent = parent.Parent
  }
  return parent, block
}

func unicornConsistentFunctionScopingOuterExpression(node *shimast.Node) *shimast.Node {
  current := node
  for current != nil && current.Parent != nil {
    parent := current.Parent
    switch parent.Kind {
    case shimast.KindParenthesizedExpression,
      shimast.KindAsExpression,
      shimast.KindSatisfiesExpression,
      shimast.KindNonNullExpression,
      shimast.KindTypeAssertionExpression:
      if parent.Expression() != current {
        return current
      }
      current = parent
    default:
      return current
    }
  }
  return current
}

// unicornConsistentFunctionScopingAcquiredScope mirrors eslint-scope's
// `scopeManager.acquire`: it yields a scope only for nodes that create one.
// A function body block never carries its own block scope, so a definition
// sitting one standalone block below it has no acquirable parent scope and
// stays unchecked, and namespace bodies attach their scope to the module
// declaration, which the TypeScript scope manager likewise never surfaces as
// a checkable parent.
func unicornConsistentFunctionScopingAcquiredScope(node *shimast.Node) *shimast.Node {
  if node == nil {
    return nil
  }
  switch node.Kind {
  case shimast.KindSourceFile,
    shimast.KindCatchClause,
    shimast.KindClassStaticBlockDeclaration,
    shimast.KindSwitchStatement,
    shimast.KindClassDeclaration,
    shimast.KindClassExpression:
    return node
  case shimast.KindBlock:
    if parent := node.Parent; parent != nil && isFunctionLikeKind(parent) && parent.Body() == node {
      return nil
    }
    return node
  case shimast.KindForStatement, shimast.KindForInStatement, shimast.KindForOfStatement:
    if unicornConsistentFunctionScopingIsLexicalLoop(node) {
      return node
    }
    return nil
  }
  if isFunctionLikeKind(node) {
    return node
  }
  return nil
}

// isLexicalLoop reports whether a for/for-in/for-of statement declares
// let/const bindings in its head. eslint-scope creates a for scope only in
// that case; `var` heads and plain assignment targets resolve into the
// surrounding scope instead.
func unicornConsistentFunctionScopingIsLexicalLoop(loop *shimast.Node) bool {
  if loop == nil {
    return false
  }
  var initializer *shimast.Node
  switch loop.Kind {
  case shimast.KindForStatement:
    if statement := loop.AsForStatement(); statement != nil {
      initializer = statement.Initializer
    }
  case shimast.KindForInStatement, shimast.KindForOfStatement:
    if statement := loop.AsForInOrOfStatement(); statement != nil {
      initializer = statement.Initializer
    }
  }
  return initializer != nil && initializer.Kind == shimast.KindVariableDeclarationList &&
    initializer.Flags&shimast.NodeFlagsBlockScoped != 0
}

// unicornConsistentFunctionScopingScopeOwner returns the innermost node that
// owns the scope a reference reads from, the analogue of `reference.from` in
// eslint-scope. Beyond runtime scopes it stops at type-level scope holders
// (function/constructor types, signatures, conditional and mapped types, and
// type/interface/enum declarations): the TypeScript scope manager gives those
// their own scopes, so an annotation nested in them does not read from the
// surrounding function scope.
func unicornConsistentFunctionScopingScopeOwner(node *shimast.Node) *shimast.Node {
  for ancestor := node; ancestor != nil; ancestor = ancestor.Parent {
    if isFunctionLikeKind(ancestor) {
      return ancestor
    }
    switch ancestor.Kind {
    case shimast.KindBlock:
      return unicornConsistentFunctionScopingScopeIdentity(ancestor)
    case shimast.KindForStatement, shimast.KindForInStatement, shimast.KindForOfStatement:
      if unicornConsistentFunctionScopingIsLexicalLoop(ancestor) {
        return ancestor
      }
    case shimast.KindModuleBlock,
      shimast.KindCatchClause,
      shimast.KindClassStaticBlockDeclaration,
      shimast.KindSwitchStatement,
      shimast.KindClassDeclaration,
      shimast.KindClassExpression,
      shimast.KindPropertyDeclaration,
      shimast.KindSourceFile,
      shimast.KindFunctionType,
      shimast.KindConstructorType,
      shimast.KindCallSignature,
      shimast.KindConstructSignature,
      shimast.KindMethodSignature,
      shimast.KindConditionalType,
      shimast.KindMappedType,
      shimast.KindTypeAliasDeclaration,
      shimast.KindInterfaceDeclaration,
      shimast.KindEnumDeclaration:
      return ancestor
    }
  }
  return nil
}

func unicornConsistentFunctionScopingScopeIdentity(scope *shimast.Node) *shimast.Node {
  if scope == nil || scope.Kind != shimast.KindBlock || scope.Parent == nil ||
    !isFunctionLikeKind(scope.Parent) || scope.Parent.Body() != scope {
    return scope
  }
  return scope.Parent
}

func unicornConsistentFunctionScopingLoopScopeChain(block *shimast.Node) []*shimast.Node {
  var scopes []*shimast.Node
  for current := block; current != nil && current.Kind == shimast.KindBlock; current = current.Parent {
    scopes = append(scopes, unicornConsistentFunctionScopingScopeIdentity(current))
    parent := current.Parent
    if parent == nil {
      break
    }
    switch parent.Kind {
    case shimast.KindDoStatement,
      shimast.KindWhileStatement,
      shimast.KindForStatement,
      shimast.KindForInStatement,
      shimast.KindForOfStatement:
      if unicornConsistentFunctionScopingLoopBody(parent) == current {
        // The loop statement carries a scope of its own only when its head
        // declares let/const bindings; while/do statements and `var` heads
        // contribute nothing beyond the body blocks.
        if unicornConsistentFunctionScopingIsLexicalLoop(parent) {
          scopes = append(scopes, parent)
        }
        return scopes
      }
    }
  }
  return nil
}

// unicornConsistentFunctionScopingLoopBody returns a loop statement's body.
// Loop statements store it in IterationStatementBase.Statement; Node.Body()
// covers only the function-like BodyData carriers and silently yields nil
// for loops, which would sever every loop-body scope chain.
func unicornConsistentFunctionScopingLoopBody(loop *shimast.Node) *shimast.Node {
  switch loop.Kind {
  case shimast.KindDoStatement:
    if statement := loop.AsDoStatement(); statement != nil {
      return statement.Statement
    }
  case shimast.KindWhileStatement:
    if statement := loop.AsWhileStatement(); statement != nil {
      return statement.Statement
    }
  case shimast.KindForStatement:
    if statement := loop.AsForStatement(); statement != nil {
      return statement.Statement
    }
  case shimast.KindForInStatement, shimast.KindForOfStatement:
    if statement := loop.AsForInOrOfStatement(); statement != nil {
      return statement.Statement
    }
  }
  return nil
}

func (scopes *unicornConsistentFunctionScopingScopeSet) add(scope *shimast.Node) {
  if scopes == nil || scope == nil {
    return
  }
  scopes.owners[scope] = struct{}{}
}

func (scopes unicornConsistentFunctionScopingScopeSet) contains(scope *shimast.Node) bool {
  if scope == nil {
    return false
  }
  _, exists := scopes.owners[scope]
  return exists
}

func (scopes unicornConsistentFunctionScopingScopeSet) containsKind(kind shimast.Kind) bool {
  for scope := range scopes.owners {
    if scope.Kind == kind {
      return true
    }
  }
  return false
}

var unicornConsistentFunctionScopingReactHooks = map[string]struct{}{
  "useState": {}, "useEffect": {}, "useContext": {}, "useReducer": {},
  "useCallback": {}, "useMemo": {}, "useRef": {}, "useImperativeHandle": {},
  "useLayoutEffect": {}, "useDebugValue": {},
}

func unicornConsistentFunctionScopingIsReactHookScope(scope *shimast.Node) bool {
  call := unicornConsistentFunctionScopingContainingCall(scope)
  if call == nil {
    return false
  }
  expression := call.AsCallExpression().Expression
  if expression == nil {
    return false
  }
  expression = stripParens(expression)
  if expression.Kind == shimast.KindIdentifier {
    _, exists := unicornConsistentFunctionScopingReactHooks[identifierText(expression)]
    return exists
  }
  if expression.Kind != shimast.KindPropertyAccessExpression {
    return false
  }
  access := expression.AsPropertyAccessExpression()
  if access == nil || access.QuestionDotToken != nil ||
    identifierText(stripParens(access.Expression)) != "React" {
    return false
  }
  _, exists := unicornConsistentFunctionScopingReactHooks[identifierText(access.Name())]
  return exists
}

func unicornConsistentFunctionScopingContainingCall(function *shimast.Node) *shimast.Node {
  if !unicornConsistentFunctionScopingIsCandidate(function) {
    return nil
  }
  expression := unicornConsistentFunctionScopingOuterExpression(function)
  if expression == nil || expression.Parent == nil || expression.Parent.Kind != shimast.KindCallExpression {
    return nil
  }
  return expression.Parent
}

func unicornConsistentFunctionScopingIsIIFE(function *shimast.Node) bool {
  call := unicornConsistentFunctionScopingContainingCall(function)
  if call == nil {
    return false
  }
  expression := call.AsCallExpression()
  return expression != nil && stripParens(expression.Expression) == function
}

func unicornConsistentFunctionScopingInsideJestMockFactory(function *shimast.Node) bool {
  for ancestor := function; ancestor != nil; ancestor = ancestor.Parent {
    if !unicornConsistentFunctionScopingIsCandidate(ancestor) {
      continue
    }
    call := unicornConsistentFunctionScopingContainingCall(ancestor)
    if call == nil {
      continue
    }
    expression := call.AsCallExpression()
    if expression == nil || expression.Arguments == nil || len(expression.Arguments.Nodes) < 2 ||
      stripParens(expression.Arguments.Nodes[1]) != ancestor ||
      !unicornConsistentFunctionScopingMatchesPath(expression.Expression, "jest", "mock") {
      continue
    }
    return true
  }
  return false
}

func unicornConsistentFunctionScopingMatchesPath(
  expression *shimast.Node,
  object string,
  property string,
) bool {
  expression = stripParens(expression)
  if expression == nil || expression.Kind != shimast.KindPropertyAccessExpression {
    return false
  }
  access := expression.AsPropertyAccessExpression()
  return access != nil && access.QuestionDotToken == nil &&
    identifierText(stripParens(access.Expression)) == object &&
    identifierText(access.Name()) == property
}

func unicornConsistentFunctionScopingMessage(function *shimast.Node) string {
  kind := "function"
  async := function.ModifierFlags()&shimast.ModifierFlagsAsync != 0
  generator := false
  switch function.Kind {
  case shimast.KindArrowFunction:
    kind = "arrow function"
  case shimast.KindFunctionDeclaration:
    declaration := function.AsFunctionDeclaration()
    generator = declaration != nil && declaration.AsteriskToken != nil
  case shimast.KindFunctionExpression:
    expression := function.AsFunctionExpression()
    generator = expression != nil && expression.AsteriskToken != nil
  }
  switch {
  case async && generator:
    kind = "async generator function"
  case generator:
    kind = "generator function"
  case async:
    kind = "async " + kind
  }
  if name := unicornConsistentFunctionScopingFunctionName(function); name != "" {
    kind += " '" + name + "'"
  }
  return "Move " + kind + " to the outer scope."
}

func unicornConsistentFunctionScopingFunctionName(function *shimast.Node) string {
  if name := identifierText(function.Name()); name != "" {
    return name
  }
  expression := unicornConsistentFunctionScopingOuterExpression(function)
  if expression == nil || expression.Parent == nil || expression.Parent.Kind != shimast.KindVariableDeclaration {
    return ""
  }
  declaration := expression.Parent.AsVariableDeclaration()
  if declaration == nil || declaration.Initializer != expression {
    return ""
  }
  return identifierText(declaration.Name())
}

func unicornConsistentFunctionScopingReportRange(
  file *shimast.SourceFile,
  function *shimast.Node,
) (int, int) {
  if file == nil || function == nil {
    return -1, -1
  }
  source := file.Text()
  if function.Kind == shimast.KindArrowFunction {
    arrow := function.AsArrowFunction()
    if arrow == nil || arrow.EqualsGreaterThanToken == nil {
      return -1, -1
    }
    // Token positions include leading trivia; the finding must cover the
    // bare `=>` the way upstream's getFunctionHeadLocation does.
    start := shimscanner.SkipTrivia(source, arrow.EqualsGreaterThanToken.Pos())
    end := arrow.EqualsGreaterThanToken.End()
    if start < 0 || end < start || end > len(source) {
      return -1, -1
    }
    return start, end
  }

  start := shimscanner.SkipTrivia(source, function.Pos())
  if start < 0 || start >= len(source) {
    return -1, -1
  }
  // Upstream's getFunctionHeadLocation ends the head at the opening paren of
  // the parameters: the token after the name for named functions, the first
  // paren in the node otherwise.
  scanFrom := start
  if name := function.Name(); name != nil && name.End() > start && name.End() <= len(source) {
    scanFrom = name.End()
  }
  if scanFrom >= function.End() || function.End() > len(source) {
    return -1, -1
  }
  scanner := shimscanner.NewScanner()
  scanner.SetText(source[scanFrom:function.End()])
  scanner.SetSkipTrivia(true)
  for {
    switch scanner.Scan() {
    case shimast.KindOpenParenToken:
      return start, scanFrom + scanner.TokenStart()
    case shimast.KindEndOfFile:
      return -1, -1
    }
  }
}

func init() {
  Register(unicornConsistentFunctionScoping{})
}
