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
// at every depth because Jest forbids their out-of-scope references. Arrow
// functions that capture lexical this, super, or arguments are also immovable.
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
  ctx                    *Context
  declarationIdentifiers map[*shimast.Node]struct{}
  referencesBySymbol     map[*shimast.Symbol][]*shimast.Node
  unresolvedPrivate      []*shimast.Node
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
    ctx:                    ctx,
    declarationIdentifiers: make(map[*shimast.Node]struct{}),
    referencesBySymbol:     make(map[*shimast.Symbol][]*shimast.Node),
  }
  walkDescendants(source, func(node *shimast.Node) {
    if node.Kind == shimast.KindShorthandPropertyAssignment {
      return
    }
    for _, identifier := range unicornConsistentFunctionScopingNamedIdentifiers(node.Name()) {
      analysis.declarationIdentifiers[identifier] = struct{}{}
    }
  })
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
    analysis.referencesBySymbol[symbol] = append(analysis.referencesBySymbol[symbol], node)
  })
  return analysis
}

func unicornConsistentFunctionScopingNamedIdentifiers(name *shimast.Node) []*shimast.Node {
  if name == nil {
    return nil
  }
  switch name.Kind {
  case shimast.KindIdentifier:
    return []*shimast.Node{name}
  case shimast.KindObjectBindingPattern, shimast.KindArrayBindingPattern:
    return bindingIdentifierNodes(name)
  }
  return nil
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
  if _, declaration := analysis.declarationIdentifiers[node]; declaration {
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
  if isValueReferenceIdentifier(node) {
    return true
  }
  if node == nil || node.Parent == nil || node.Parent.Kind != shimast.KindTypeReference {
    return false
  }
  reference := node.Parent.AsTypeReferenceNode()
  return reference != nil && reference.TypeName == node
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
    if !usedInside || unicornConsistentFunctionScopingSymbolDeclaredInside(symbol, function) {
      continue
    }
    if privateReference || unicornConsistentFunctionScopingSymbolDeclaredInScopes(symbol, scopes) {
      return true
    }

    // Upstream keeps a nested function beside direct uses of the same binding
    // in the surrounding scope. Inspect all resolved references, but require an
    // exact scope owner so a sibling closure does not masquerade as its parent.
    for _, reference := range references {
      if noLoopFuncNodeContains(function, reference) {
        continue
      }
      if scopes.contains(unicornConsistentFunctionScopingScopeOwner(reference)) {
        return true
      }
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
  if symbol.ValueDeclaration != nil &&
    scopes.contains(unicornConsistentFunctionScopingDeclarationScope(symbol.ValueDeclaration)) {
    return true
  }
  for _, declaration := range symbol.Declarations {
    if declaration != nil &&
      scopes.contains(unicornConsistentFunctionScopingDeclarationScope(declaration)) {
      return true
    }
  }
  return false
}

func unicornConsistentFunctionScopingDeclarationScope(declaration *shimast.Node) *shimast.Node {
  if declaration == nil {
    return nil
  }
  switch declaration.Kind {
  case shimast.KindFunctionDeclaration, shimast.KindClassDeclaration:
    return unicornConsistentFunctionScopingScopeOwner(declaration.Parent)
  }
  return unicornConsistentFunctionScopingScopeOwner(declaration)
}

func (analysis *unicornConsistentFunctionScopingAnalysis) arrowCapturesLexicalEnvironment(
  arrow *shimast.Node,
) bool {
  captured := false
  walkDescendants(arrow, func(node *shimast.Node) {
    if captured || node == arrow {
      return
    }
    switch node.Kind {
    case shimast.KindThisKeyword, shimast.KindSuperKeyword:
      captured = unicornConsistentFunctionScopingLexicalReferenceBelongsToArrow(node, arrow)
    case shimast.KindIdentifier:
      if identifierText(node) != "arguments" || !analysis.isReference(node) ||
        !unicornConsistentFunctionScopingLexicalReferenceBelongsToArrow(node, arrow) {
        return
      }
      symbol := unicornConsistentFunctionScopingSymbol(analysis.ctx, node)
      captured = symbol == nil || !unicornConsistentFunctionScopingSymbolDeclaredInside(symbol, arrow)
    }
  })
  return captured
}

func unicornConsistentFunctionScopingLexicalReferenceBelongsToArrow(
  reference *shimast.Node,
  arrow *shimast.Node,
) bool {
  for ancestor := reference.Parent; ancestor != nil; ancestor = ancestor.Parent {
    if ancestor == arrow {
      return true
    }
    if isFunctionLikeKind(ancestor) && ancestor.Kind != shimast.KindArrowFunction {
      return false
    }
    if ancestor.Kind == shimast.KindClassDeclaration || ancestor.Kind == shimast.KindClassExpression {
      if !unicornConsistentFunctionScopingClassPositionUsesOuterLexicalEnvironment(reference, ancestor) {
        return false
      }
    }
  }
  return false
}

func unicornConsistentFunctionScopingClassPositionUsesOuterLexicalEnvironment(
  reference *shimast.Node,
  class *shimast.Node,
) bool {
  for ancestor := reference.Parent; ancestor != nil && ancestor != class; ancestor = ancestor.Parent {
    switch ancestor.Kind {
    case shimast.KindComputedPropertyName, shimast.KindHeritageClause, shimast.KindDecorator:
      return true
    }
  }
  return false
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
  if main == nil {
    return unicornConsistentFunctionScopingScopeSet{}, false
  }

  scopes := unicornConsistentFunctionScopingScopeSet{
    owners: make(map[*shimast.Node]struct{}),
    main:   main,
  }
  scopes.add(main)
  if block != nil {
    scopes.add(unicornConsistentFunctionScopingScopeIdentity(block))
    for _, owner := range unicornConsistentFunctionScopingLoopScopeChain(block) {
      scopes.add(owner)
    }
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

func unicornConsistentFunctionScopingAcquiredScope(node *shimast.Node) *shimast.Node {
  if node == nil {
    return nil
  }
  switch node.Kind {
  case shimast.KindSourceFile,
    shimast.KindBlock,
    shimast.KindModuleBlock,
    shimast.KindCatchClause,
    shimast.KindClassStaticBlockDeclaration,
    shimast.KindForStatement,
    shimast.KindForInStatement,
    shimast.KindForOfStatement,
    shimast.KindSwitchStatement,
    shimast.KindClassDeclaration,
    shimast.KindClassExpression:
    return unicornConsistentFunctionScopingScopeIdentity(node)
  }
  if isFunctionLikeKind(node) {
    return node
  }
  return nil
}

func unicornConsistentFunctionScopingScopeOwner(node *shimast.Node) *shimast.Node {
  for ancestor := node; ancestor != nil; ancestor = ancestor.Parent {
    if isFunctionLikeKind(ancestor) {
      return ancestor
    }
    switch ancestor.Kind {
    case shimast.KindBlock:
      return unicornConsistentFunctionScopingScopeIdentity(ancestor)
    case shimast.KindModuleBlock,
      shimast.KindCatchClause,
      shimast.KindClassStaticBlockDeclaration,
      shimast.KindForStatement,
      shimast.KindForInStatement,
      shimast.KindForOfStatement,
      shimast.KindSwitchStatement,
      shimast.KindClassDeclaration,
      shimast.KindClassExpression,
      shimast.KindPropertyDeclaration,
      shimast.KindSourceFile:
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
      if parent.Body() == current {
        scopes = append(scopes, parent)
        return scopes
      }
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
  if function.Kind == shimast.KindArrowFunction {
    arrow := function.AsArrowFunction()
    if arrow == nil || arrow.EqualsGreaterThanToken == nil {
      return -1, -1
    }
    return arrow.EqualsGreaterThanToken.Pos(), arrow.EqualsGreaterThanToken.End()
  }

  source := file.Text()
  start := shimscanner.SkipTrivia(source, function.Pos())
  if start < 0 || start >= len(source) {
    return -1, -1
  }
  if name := function.Name(); name != nil && name.End() >= start && name.End() <= len(source) {
    return start, name.End()
  }
  scanner := shimscanner.NewScanner()
  scanner.SetText(source[start:function.End()])
  scanner.SetSkipTrivia(true)
  for {
    switch scanner.Scan() {
    case shimast.KindFunctionKeyword:
      return start + scanner.TokenStart(), start + scanner.TokenEnd()
    case shimast.KindEndOfFile:
      return -1, -1
    }
  }
}

func init() {
  Register(unicornConsistentFunctionScoping{})
}
