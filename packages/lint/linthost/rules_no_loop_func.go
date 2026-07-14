// noLoopFunc reports closures created in loops only when they capture a
// binding whose value can change between iterations. The analysis mirrors
// ESLint's reference semantics while using TypeScript-Go symbols to preserve
// lexical identity through shadowing, destructuring, and TypeScript syntax.
// https://eslint.org/docs/latest/rules/no-loop-func
package linthost

import (
  "strings"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

type noLoopFunc struct{}

type noLoopFuncReference struct {
  node   *shimast.Node
  symbol *shimast.Symbol
  scope  *shimast.Node
}

type noLoopFuncBindingKind uint8

const (
  noLoopFuncOtherBinding noLoopFuncBindingKind = iota
  noLoopFuncLetBinding
  noLoopFuncConstantBinding
)

type noLoopFuncBinding struct {
  rangeNode *shimast.Node
  scope     *shimast.Node
  kind      noLoopFuncBindingKind
}

type noLoopFuncAnalysis struct {
  ctx                    *Context
  declarationIdentifiers map[*shimast.Node]struct{}
  writeIdentifiers       map[*shimast.Node]struct{}
  functionReferences     map[*shimast.Node][]noLoopFuncReference
  writesBySymbol         map[*shimast.Symbol][]noLoopFuncReference
  bindings               map[*shimast.Symbol]noLoopFuncBinding
  skippedIIFEs           map[*shimast.Node]struct{}
}

func (noLoopFunc) Name() string             { return "no-loop-func" }
func (noLoopFunc) NeedsTypeChecker() bool   { return true }
func (noLoopFunc) Visits() []shimast.Kind   { return []shimast.Kind{shimast.KindSourceFile} }
func (noLoopFunc) Check(ctx *Context, node *shimast.Node) {
  if ctx.Checker == nil || node == nil {
    return
  }

  analysis := &noLoopFuncAnalysis{
    ctx:                    ctx,
    declarationIdentifiers: make(map[*shimast.Node]struct{}),
    writeIdentifiers:       make(map[*shimast.Node]struct{}),
    functionReferences:     make(map[*shimast.Node][]noLoopFuncReference),
    writesBySymbol:         make(map[*shimast.Symbol][]noLoopFuncReference),
    bindings:               make(map[*shimast.Symbol]noLoopFuncBinding),
    skippedIIFEs:           make(map[*shimast.Node]struct{}),
  }
  analysis.collectSyntax(node)
  analysis.collectReferences(node)
  analysis.checkFunctions(node)
}

func (a *noLoopFuncAnalysis) collectSyntax(source *shimast.Node) {
  walkDescendants(source, func(node *shimast.Node) {
    if node.Kind != shimast.KindShorthandPropertyAssignment {
      for _, identifier := range noLoopFuncNamedIdentifiers(node.Name()) {
        a.declarationIdentifiers[identifier] = struct{}{}
      }
    }

    for _, identifier := range writeTargetIdentifiers(node) {
      a.writeIdentifiers[identifier] = struct{}{}
    }

    if node.Kind != shimast.KindVariableDeclaration {
      return
    }
    declaration := node.AsVariableDeclaration()
    if declaration == nil {
      return
    }
    initialized := declaration.Initializer != nil
    if !initialized && node.Parent != nil && node.Parent.Kind == shimast.KindVariableDeclarationList &&
      node.Parent.Parent != nil &&
      (node.Parent.Parent.Kind == shimast.KindForInStatement || node.Parent.Parent.Kind == shimast.KindForOfStatement) {
      statement := node.Parent.Parent.AsForInOrOfStatement()
      initialized = statement != nil && statement.Initializer == node.Parent
    }
    if initialized {
      for _, identifier := range bindingIdentifierNodes(declaration.Name()) {
        a.writeIdentifiers[identifier] = struct{}{}
      }
    }
  })
}

// noLoopFuncNamedIdentifiers returns identifier-shaped names without asking
// the AST to reinterpret arbitrary declaration names as binding patterns.
// Computed names contain evaluated expressions and must remain available to
// reference analysis, while ordinary named declarations and members are not
// runtime references to their own spelling.
func noLoopFuncNamedIdentifiers(name *shimast.Node) []*shimast.Node {
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

func (a *noLoopFuncAnalysis) collectReferences(source *shimast.Node) {
  walkDescendants(source, func(node *shimast.Node) {
    if node.Kind != shimast.KindIdentifier {
      return
    }

    if _, written := a.writeIdentifiers[node]; written {
      if symbol := canonicalValueSymbol(a.ctx, node); symbol != nil {
        a.writesBySymbol[symbol] = append(a.writesBySymbol[symbol], noLoopFuncReference{
          node:   node,
          symbol: symbol,
          scope:  noLoopFuncVariableScope(node),
        })
      }
    }

    if !a.isRuntimeReference(node) {
      return
    }
    symbol := canonicalValueSymbol(a.ctx, node)
    if symbol == nil {
      return
    }
    reference := noLoopFuncReference{
      node:   node,
      symbol: symbol,
      scope:  noLoopFuncVariableScope(node),
    }
    for ancestor := node.Parent; ancestor != nil; ancestor = ancestor.Parent {
      if noLoopFuncIsCheckedFunction(ancestor) && noLoopFuncReferenceBelongsToFunction(node, ancestor) {
        a.functionReferences[ancestor] = append(a.functionReferences[ancestor], reference)
      }
    }
  })
}

func (a *noLoopFuncAnalysis) isRuntimeReference(node *shimast.Node) bool {
  if _, declaration := a.declarationIdentifiers[node]; declaration {
    return false
  }
  if shimast.IsPartOfTypeNode(node) || noLoopFuncInsideTypeQuery(node) {
    return false
  }
  if !isValueReferenceIdentifier(node) {
    return false
  }
  parent := node.Parent
  if parent != nil && parent.Kind == shimast.KindBindingElement {
    binding := parent.AsBindingElement()
    if binding != nil && binding.PropertyName == node {
      return false
    }
  }
  return true
}

func (a *noLoopFuncAnalysis) checkFunctions(source *shimast.Node) {
  walkDescendants(source, func(function *shimast.Node) {
    if !noLoopFuncIsCheckedFunction(function) {
      return
    }
    loop := noLoopFuncContainingLoop(function, a.skippedIIFEs)
    if loop == nil {
      return
    }
    if noLoopFuncIsEligibleIIFE(function) && !a.isReferencedNamedIIFE(function) {
      a.skippedIIFEs[function] = struct{}{}
      return
    }

    unsafeNames := make([]string, 0)
    seenNames := make(map[string]struct{})
    safety := make(map[*shimast.Symbol]bool)
    for _, reference := range a.functionReferences[function] {
      if a.symbolDeclaredInside(reference.symbol, function) {
        continue
      }
      safe, exists := safety[reference.symbol]
      if !exists {
        safe = a.isSafe(loop, reference.symbol)
        safety[reference.symbol] = safe
      }
      if safe {
        continue
      }
      name := identifierText(reference.node)
      if name == "" {
        continue
      }
      if _, exists := seenNames[name]; exists {
        continue
      }
      seenNames[name] = struct{}{}
      unsafeNames = append(unsafeNames, name)
    }
    if len(unsafeNames) == 0 {
      return
    }
    quoted := make([]string, len(unsafeNames))
    for index, name := range unsafeNames {
      quoted[index] = "'" + name + "'"
    }
    a.ctx.Report(function, "Function declared in a loop contains unsafe references to variable(s) "+strings.Join(quoted, ", ")+".")
  })
}

func (a *noLoopFuncAnalysis) isReferencedNamedIIFE(function *shimast.Node) bool {
  if function.Kind != shimast.KindFunctionExpression {
    return false
  }
  name := function.Name()
  if name == nil || name.Kind != shimast.KindIdentifier {
    return false
  }
  symbol := canonicalValueSymbol(a.ctx, name)
  if symbol == nil {
    return false
  }
  for _, reference := range a.functionReferences[function] {
    if reference.symbol == symbol {
      return true
    }
  }
  return false
}

func (a *noLoopFuncAnalysis) symbolDeclaredInside(symbol *shimast.Symbol, function *shimast.Node) bool {
  for _, declaration := range symbol.Declarations {
    if declaration != nil && declaration.Pos() >= function.Pos() && declaration.End() <= function.End() {
      return true
    }
  }
  return false
}

func (a *noLoopFuncAnalysis) isSafe(loop *shimast.Node, symbol *shimast.Symbol) bool {
  binding := a.binding(symbol)
  if binding.kind == noLoopFuncConstantBinding {
    return true
  }
  if binding.kind == noLoopFuncLetBinding && binding.rangeNode != nil &&
    binding.rangeNode.Pos() > loop.Pos() && binding.rangeNode.End() < loop.End() {
    return true
  }

  var excluded *shimast.Node
  if binding.kind == noLoopFuncLetBinding {
    excluded = binding.rangeNode
  }
  border := noLoopFuncTopLoop(loop, excluded, a.skippedIIFEs)
  for _, write := range a.writesBySymbol[symbol] {
    if write.scope != binding.scope || write.node.Pos() >= border.Pos() {
      return false
    }
  }
  return true
}

func (a *noLoopFuncAnalysis) binding(symbol *shimast.Symbol) noLoopFuncBinding {
  if binding, exists := a.bindings[symbol]; exists {
    return binding
  }
  binding := noLoopFuncBinding{kind: noLoopFuncOtherBinding}
  declarations := symbol.Declarations
  if symbol.ValueDeclaration != nil {
    declarations = append([]*shimast.Node{symbol.ValueDeclaration}, declarations...)
  }
  for _, declaration := range declarations {
    root := noLoopFuncRootVariableDeclaration(declaration)
    if root == nil || root.Kind != shimast.KindVariableDeclaration {
      if binding.rangeNode == nil && declaration != nil {
        binding.rangeNode = declaration
        binding.scope = noLoopFuncVariableScope(declaration)
      }
      continue
    }
    binding.rangeNode = root
    if root.Parent != nil && root.Parent.Kind == shimast.KindVariableDeclarationList {
      binding.rangeNode = root.Parent
    }
    binding.scope = noLoopFuncVariableScope(root)
    flags := shimast.GetCombinedNodeFlags(root)
    switch {
    case flags&shimast.NodeFlagsConstant != 0:
      binding.kind = noLoopFuncConstantBinding
    case flags&shimast.NodeFlagsLet != 0:
      binding.kind = noLoopFuncLetBinding
    }
    break
  }
  a.bindings[symbol] = binding
  return binding
}

func noLoopFuncRootVariableDeclaration(node *shimast.Node) *shimast.Node {
  for node != nil && node.Kind == shimast.KindBindingElement {
    if node.Parent == nil {
      return nil
    }
    node = node.Parent.Parent
  }
  return node
}

func noLoopFuncVariableScope(node *shimast.Node) *shimast.Node {
  for ancestor := node; ancestor != nil; ancestor = ancestor.Parent {
    if noLoopFuncIsAnyFunction(ancestor) || ancestor.Kind == shimast.KindSourceFile ||
      ancestor.Kind == shimast.KindClassStaticBlockDeclaration {
      return ancestor
    }
    if ancestor.Kind == shimast.KindPropertyDeclaration {
      property := ancestor.AsPropertyDeclaration()
      if property != nil && noLoopFuncNodeContains(property.Initializer, node) {
        return ancestor
      }
    }
  }
  return nil
}

func noLoopFuncContainingLoop(node *shimast.Node, skippedIIFEs map[*shimast.Node]struct{}) *shimast.Node {
  child := node
  for parent := node.Parent; parent != nil; parent = parent.Parent {
    switch parent.Kind {
    case shimast.KindWhileStatement, shimast.KindDoStatement:
      return parent
    case shimast.KindForStatement:
      statement := parent.AsForStatement()
      if statement == nil || statement.Initializer != child {
        return parent
      }
    case shimast.KindForInStatement, shimast.KindForOfStatement:
      statement := parent.AsForInOrOfStatement()
      if statement == nil || statement.Expression != child {
        return parent
      }
    default:
      if noLoopFuncIsAnyFunction(parent) {
        if _, skipped := skippedIIFEs[parent]; !skipped {
          return nil
        }
      }
    }
    child = parent
  }
  return nil
}

func noLoopFuncTopLoop(loop, excluded *shimast.Node, skippedIIFEs map[*shimast.Node]struct{}) *shimast.Node {
  top := loop
  for {
    outer := noLoopFuncContainingLoop(top, skippedIIFEs)
    if outer == nil || (excluded != nil && outer.Pos() < excluded.End()) {
      return top
    }
    top = outer
  }
}

func noLoopFuncIsEligibleIIFE(function *shimast.Node) bool {
  if function.Kind != shimast.KindFunctionExpression && function.Kind != shimast.KindArrowFunction {
    return false
  }
  if function.ModifierFlags()&shimast.ModifierFlagsAsync != 0 || noLoopFuncIsGenerator(function) {
    return false
  }
  expression := function
  parent := expression.Parent
  for parent != nil && parent.Kind == shimast.KindParenthesizedExpression && parent.Expression() == expression {
    expression = parent
    parent = parent.Parent
  }
  if parent == nil || parent.Kind != shimast.KindCallExpression {
    return false
  }
  call := parent.AsCallExpression()
  return call != nil && stripParens(call.Expression) == function
}

func noLoopFuncIsGenerator(function *shimast.Node) bool {
  if function.Kind == shimast.KindFunctionExpression {
    expression := function.AsFunctionExpression()
    return expression != nil && expression.AsteriskToken != nil
  }
  return false
}

func noLoopFuncInsideTypeQuery(node *shimast.Node) bool {
  for ancestor := node.Parent; ancestor != nil; ancestor = ancestor.Parent {
    if ancestor.Kind == shimast.KindTypeQuery {
      return true
    }
    if noLoopFuncIsAnyFunction(ancestor) || ancestor.Kind == shimast.KindSourceFile {
      return false
    }
  }
  return false
}

func noLoopFuncReferenceBelongsToFunction(reference, function *shimast.Node) bool {
  child := reference
  for child != nil && child.Parent != function {
    child = child.Parent
  }
  if child == nil {
    return false
  }
  if child == function.Body() {
    return true
  }
  if child.Kind != shimast.KindParameter {
    return false
  }
  parameter := child.AsParameterDeclaration()
  return parameter != nil &&
    (noLoopFuncNodeContains(parameter.Name(), reference) || noLoopFuncNodeContains(parameter.Initializer, reference))
}

func noLoopFuncNodeContains(container, node *shimast.Node) bool {
  for current := node; current != nil; current = current.Parent {
    if current == container {
      return true
    }
  }
  return false
}

func noLoopFuncIsCheckedFunction(node *shimast.Node) bool {
  if node == nil {
    return false
  }
  switch node.Kind {
  case shimast.KindArrowFunction,
    shimast.KindFunctionExpression,
    shimast.KindFunctionDeclaration,
    shimast.KindMethodDeclaration,
    shimast.KindGetAccessor,
    shimast.KindSetAccessor,
    shimast.KindConstructor:
    return true
  }
  return false
}

func noLoopFuncIsAnyFunction(node *shimast.Node) bool {
  return node != nil && isFunctionLikeKind(node)
}

func init() {
  Register(noLoopFunc{})
}
