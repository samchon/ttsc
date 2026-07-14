// unicorn/consistent-destructuring: once a property has been destructured
// from an object with `const {a} = foo`, later reads of `foo.a` in the same
// or a nested scope must use the destructured binding instead.
//
// The port mirrors the current upstream implementation: only `const`
// declarations whose initializer is a bare identifier or `this` are tracked;
// member reads are matched to the most recent preceding declaration through
// checker binding identity so shadowed roots, shadowed bindings, and
// same-name-different-variable pairs never collude. Reads are exempt when
// the root variable or the same member was written between the declaration
// and the read (conservatively including writes from other function scopes,
// which may execute in between through calls or closures), when the read
// sits in a positive `'prop' in obj` guarded branch (TypeScript narrowing),
// or when the member expression is itself written, called, tagged, or
// computed. Replacements ship as editor suggestions — never autofixes —
// exactly like upstream's `hasSuggestions` contract; nested member chains
// report without a suggestion.
//
// eslint-scope concepts translate as follows: variable identity is the
// checker symbol at the identifier (export/merge-normalized on both sides of
// every comparison), scope containment is AST ancestry of the declaration's
// nearest scope-creating node, and `variableScope` is the nearest
// function-like boundary (source file, function, accessor, static block,
// class-field initializer, namespace, or enum body).
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/consistent-destructuring.md
package linthost

import (
  "fmt"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimscanner "github.com/microsoft/typescript-go/shim/scanner"
)

const unicornConsistentDestructuringMessage = "Use destructured variables over properties."

type unicornConsistentDestructuring struct{}

func (unicornConsistentDestructuring) Name() string {
  return "unicorn/consistent-destructuring"
}
func (unicornConsistentDestructuring) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindSourceFile}
}

// The checker supplies binding identity: distinguishing a shadowing inner
// `foo` (or a shadowing inner destructured binding) from the declaration's
// root is exactly the resolution eslint-scope performs upstream.
func (unicornConsistentDestructuring) NeedsTypeChecker() bool { return true }

// unicornConsistentDestructuringDeclaration is one tracked
// `const {…} = foo` / `const {…} = this` declarator.
type unicornConsistentDestructuringDeclaration struct {
  // object is the unwrapped initializer node (Identifier or `this`).
  object *shimast.Node
  // objectEnd is the initializer's end offset; upstream orders every
  // declaration/read/write comparison against it.
  objectEnd int
  // key is the raw source text of the initializer ("foo" / "this").
  key string
  // rootName is the cooked identifier name; empty for `this`.
  rootName string
  // rootSymbol is the checker binding of the initializer identifier; nil
  // for `this` or an unresolvable global.
  rootSymbol *shimast.Symbol
  // thisBoundary is the enclosing `this` boundary for `this` initializers.
  thisBoundary *shimast.Node
  // pattern is the ObjectBindingPattern being declared.
  pattern *shimast.Node
  // scope is the nearest scope-creating ancestor of the declarator; a read
  // matches only when it sits inside this scope.
  scope *shimast.Node
}

// unicornConsistentDestructuringMemberWrite is one recorded write through a
// member expression (`foo.a = 1`, `foo.a++`, `delete foo.a`, destructuring
// assignment targets, `for (foo.a of …)`).
type unicornConsistentDestructuringMemberWrite struct {
  property      string
  rootName      string
  rootSymbol    *shimast.Symbol
  thisBoundary  *shimast.Node
  start         int
  variableScope *shimast.Node
}

// unicornConsistentDestructuringRootWrite is one recorded write to an
// identifier binding (assignment, update, for-in/of target, declarator init).
type unicornConsistentDestructuringRootWrite struct {
  symbol        *shimast.Symbol
  start         int
  variableScope *shimast.Node
}

// unicornConsistentDestructuringState is the per-file collection pass state.
type unicornConsistentDestructuringState struct {
  ctx             *Context
  declarations    map[string][]*unicornConsistentDestructuringDeclaration
  members         []*shimast.Node
  memberWrites    []unicornConsistentDestructuringMemberWrite
  rootWrites      []unicornConsistentDestructuringRootWrite
  memberWriteSeen map[*shimast.Node]struct{}
  rootWriteSeen   map[*shimast.Node]struct{}
}

func (unicornConsistentDestructuring) Check(ctx *Context, root *shimast.Node) {
  if ctx == nil || ctx.File == nil || root == nil {
    return
  }
  state := &unicornConsistentDestructuringState{
    ctx:             ctx,
    declarations:    make(map[string][]*unicornConsistentDestructuringDeclaration),
    memberWriteSeen: make(map[*shimast.Node]struct{}),
    rootWriteSeen:   make(map[*shimast.Node]struct{}),
  }
  walkDescendants(root, state.collect)
  for _, member := range state.members {
    state.checkMember(member)
  }
}

// collect records declarations, member reads, member writes, and root-binding
// writes in one source-order pass, mirroring upstream's listener set.
func (s *unicornConsistentDestructuringState) collect(node *shimast.Node) {
  switch node.Kind {
  case shimast.KindVariableDeclaration:
    s.collectDeclaration(node)
    s.collectDeclaratorRootWrites(node)
  case shimast.KindBinaryExpression:
    expression := node.AsBinaryExpression()
    if expression != nil && expression.OperatorToken != nil &&
      isAssignmentOperator(expression.OperatorToken.Kind) {
      s.collectMemberWritesFromTarget(expression.Left)
      s.collectRootWrites(node)
    }
  case shimast.KindPrefixUnaryExpression:
    expression := node.AsPrefixUnaryExpression()
    if expression != nil &&
      (expression.Operator == shimast.KindPlusPlusToken || expression.Operator == shimast.KindMinusMinusToken) {
      s.addDirectMemberWrite(stripParens(expression.Operand))
      s.collectRootWrites(node)
    }
  case shimast.KindPostfixUnaryExpression:
    expression := node.AsPostfixUnaryExpression()
    if expression != nil &&
      (expression.Operator == shimast.KindPlusPlusToken || expression.Operator == shimast.KindMinusMinusToken) {
      s.addDirectMemberWrite(stripParens(expression.Operand))
      s.collectRootWrites(node)
    }
  case shimast.KindDeleteExpression:
    expression := node.AsDeleteExpression()
    if expression != nil {
      s.addDirectMemberWrite(stripParens(expression.Expression))
    }
  case shimast.KindForInStatement, shimast.KindForOfStatement:
    statement := node.AsForInOrOfStatement()
    if statement == nil || statement.Initializer == nil {
      return
    }
    if statement.Initializer.Kind == shimast.KindVariableDeclarationList {
      s.collectForHeadDeclarationRootWrites(statement.Initializer)
      return
    }
    s.collectMemberWritesFromTarget(statement.Initializer)
    s.collectRootWrites(node)
  case shimast.KindPropertyAccessExpression:
    if !unicornConsistentDestructuringIsJsxTagName(node) {
      s.members = append(s.members, node)
    }
  }
}

// collectDeclaration tracks `const {…} = <identifier|this>` declarators.
// Upstream requires the `const` kind, an object pattern, and a "simple"
// initializer (identifier or `this`); parentheses are unwrapped because the
// ESTree oracle never materializes them, while TypeScript assertion wrappers
// intentionally disqualify the initializer exactly as upstream does.
func (s *unicornConsistentDestructuringState) collectDeclaration(node *shimast.Node) {
  declaration := node.AsVariableDeclaration()
  if declaration == nil || declaration.Initializer == nil {
    return
  }
  name := declaration.Name()
  if name == nil || name.Kind != shimast.KindObjectBindingPattern {
    return
  }
  if node.Parent == nil || node.Parent.Kind != shimast.KindVariableDeclarationList ||
    !shimast.IsConst(node) {
    return
  }
  object := stripParens(declaration.Initializer)
  if object == nil ||
    (object.Kind != shimast.KindIdentifier && object.Kind != shimast.KindThisKeyword) {
    return
  }
  entry := &unicornConsistentDestructuringDeclaration{
    object:    object,
    objectEnd: object.End(),
    key:       nodeText(s.ctx.File, object),
    pattern:   name,
    scope:     unicornConsistentDestructuringNearestScope(node),
  }
  if object.Kind == shimast.KindIdentifier {
    entry.rootName = identifierText(object)
    entry.rootSymbol = canonicalValueSymbol(s.ctx, object)
  } else {
    entry.thisBoundary = unicornConsistentDestructuringThisBoundary(object)
  }
  if entry.key == "" {
    return
  }
  s.declarations[entry.key] = append(s.declarations[entry.key], entry)
}

// collectMemberWritesFromTarget descends one assignment target the way
// upstream's addMemberExpressionWrites walks ESTree patterns. TypeScript-Go
// parses assignment destructuring targets as array/object literal
// expressions; property keys and default-value right sides are reads and are
// therefore not descended into.
func (s *unicornConsistentDestructuringState) collectMemberWritesFromTarget(node *shimast.Node) {
  if node == nil {
    return
  }
  switch node.Kind {
  case shimast.KindPropertyAccessExpression:
    s.addDirectMemberWrite(node)
  case shimast.KindParenthesizedExpression:
    s.collectMemberWritesFromTarget(stripParens(node))
  case shimast.KindBinaryExpression:
    // A default inside a pattern (`[foo.a = 1] = …`) parses as an `=`
    // binary expression; only its left side is written.
    expression := node.AsBinaryExpression()
    if expression != nil && expression.OperatorToken != nil &&
      expression.OperatorToken.Kind == shimast.KindEqualsToken {
      s.collectMemberWritesFromTarget(expression.Left)
    }
  case shimast.KindArrayLiteralExpression:
    array := node.AsArrayLiteralExpression()
    if array != nil && array.Elements != nil {
      for _, element := range array.Elements.Nodes {
        s.collectMemberWritesFromTarget(element)
      }
    }
  case shimast.KindObjectLiteralExpression:
    object := node.AsObjectLiteralExpression()
    if object == nil || object.Properties == nil {
      return
    }
    for _, property := range object.Properties.Nodes {
      switch property.Kind {
      case shimast.KindPropertyAssignment:
        if assignment := property.AsPropertyAssignment(); assignment != nil {
          s.collectMemberWritesFromTarget(assignment.Initializer)
        }
      case shimast.KindSpreadAssignment:
        if spread := property.AsSpreadAssignment(); spread != nil {
          s.collectMemberWritesFromTarget(spread.Expression)
        }
      }
    }
  case shimast.KindSpreadElement:
    if spread := node.AsSpreadElement(); spread != nil {
      s.collectMemberWritesFromTarget(spread.Expression)
    }
  }
}

// addDirectMemberWrite records one `<identifier|this>.<name>` write target.
// Computed properties and private names are skipped, mirroring upstream's
// identifier-property requirement; the object is unwrapped through parens
// and TypeScript assertion wrappers so `foo!.a = 1` still shields `foo.a`.
func (s *unicornConsistentDestructuringState) addDirectMemberWrite(node *shimast.Node) {
  if node == nil || node.Kind != shimast.KindPropertyAccessExpression {
    return
  }
  access := node.AsPropertyAccessExpression()
  if access == nil {
    return
  }
  name := access.Name()
  if name == nil || name.Kind != shimast.KindIdentifier {
    return
  }
  object := unicornConsistentDestructuringUnwrapObject(access.Expression)
  if object == nil ||
    (object.Kind != shimast.KindIdentifier && object.Kind != shimast.KindThisKeyword) {
    return
  }
  if _, duplicate := s.memberWriteSeen[node]; duplicate {
    return
  }
  s.memberWriteSeen[node] = struct{}{}
  write := unicornConsistentDestructuringMemberWrite{
    property:      identifierText(name),
    start:         shimscanner.SkipTrivia(s.ctx.File.Text(), node.Pos()),
    variableScope: unicornConsistentDestructuringVariableScope(node),
  }
  if object.Kind == shimast.KindIdentifier {
    write.rootName = identifierText(object)
    write.rootSymbol = canonicalValueSymbol(s.ctx, object)
  } else {
    write.thisBoundary = unicornConsistentDestructuringThisBoundary(object)
  }
  s.memberWrites = append(s.memberWrites, write)
}

// collectRootWrites records identifier write targets of one assignment,
// update, or for-in/of head — the same references eslint-scope marks
// isWrite() on the root variable.
func (s *unicornConsistentDestructuringState) collectRootWrites(node *shimast.Node) {
  for _, identifier := range writeTargetIdentifiers(node) {
    s.addRootWrite(identifier)
  }
}

// collectDeclaratorRootWrites records the initialized bindings of one
// declarator. eslint-scope counts a declarator's init as a write reference,
// which matters when a `var` redeclaration re-binds the tracked root.
func (s *unicornConsistentDestructuringState) collectDeclaratorRootWrites(node *shimast.Node) {
  declaration := node.AsVariableDeclaration()
  if declaration == nil || declaration.Initializer == nil {
    return
  }
  s.addBindingNameWrites(declaration.Name())
}

// collectForHeadDeclarationRootWrites records `for (const x of …)` style
// heads: the declared names are written on every iteration even though the
// declarator itself has no initializer.
func (s *unicornConsistentDestructuringState) collectForHeadDeclarationRootWrites(list *shimast.Node) {
  declarationList := list.AsVariableDeclarationList()
  if declarationList == nil || declarationList.Declarations == nil {
    return
  }
  for _, declaration := range declarationList.Declarations.Nodes {
    if variable := declaration.AsVariableDeclaration(); variable != nil {
      s.addBindingNameWrites(variable.Name())
    }
  }
}

// addBindingNameWrites walks a binding name (identifier or nested pattern)
// and records each bound identifier as a write.
func (s *unicornConsistentDestructuringState) addBindingNameWrites(name *shimast.Node) {
  if name == nil {
    return
  }
  switch name.Kind {
  case shimast.KindIdentifier:
    s.addRootWrite(name)
  case shimast.KindObjectBindingPattern, shimast.KindArrayBindingPattern:
    pattern := name.AsBindingPattern()
    if pattern == nil || pattern.Elements == nil {
      return
    }
    for _, element := range pattern.Elements.Nodes {
      if binding := element.AsBindingElement(); binding != nil {
        s.addBindingNameWrites(binding.Name())
      }
    }
  }
}

func (s *unicornConsistentDestructuringState) addRootWrite(identifier *shimast.Node) {
  if identifier == nil || identifier.Kind != shimast.KindIdentifier {
    return
  }
  if _, duplicate := s.rootWriteSeen[identifier]; duplicate {
    return
  }
  s.rootWriteSeen[identifier] = struct{}{}
  symbol := canonicalValueSymbol(s.ctx, identifier)
  if symbol == nil {
    return
  }
  s.rootWrites = append(s.rootWrites, unicornConsistentDestructuringRootWrite{
    symbol:        symbol,
    start:         shimscanner.SkipTrivia(s.ctx.File.Text(), identifier.Pos()),
    variableScope: unicornConsistentDestructuringVariableScope(identifier),
  })
}

// checkMember mirrors upstream's getProblem for one collected member read.
func (s *unicornConsistentDestructuringState) checkMember(node *shimast.Node) {
  access := node.AsPropertyAccessExpression()
  if access == nil || access.Name() == nil {
    return
  }
  if s.shouldIgnoreMember(node) {
    return
  }
  object := unicornConsistentDestructuringUnwrapObject(access.Expression)
  if object == nil ||
    (object.Kind != shimast.KindIdentifier && object.Kind != shimast.KindThisKeyword) {
    return
  }
  matching := s.declarations[nodeText(s.ctx.File, object)]
  if len(matching) == 0 {
    return
  }
  memberStart := shimscanner.SkipTrivia(s.ctx.File.Text(), node.Pos())
  memberVariableScope := unicornConsistentDestructuringVariableScope(node)
  var memberRootName string
  var memberRootSymbol *shimast.Symbol
  var memberThisBoundary *shimast.Node
  if object.Kind == shimast.KindIdentifier {
    memberRootName = identifierText(object)
    memberRootSymbol = canonicalValueSymbol(s.ctx, object)
  } else {
    memberThisBoundary = unicornConsistentDestructuringThisBoundary(object)
  }
  // Upstream matches the destructured key against the raw property text
  // (`sourceCode.getText(node.property)`), while write shielding compares
  // cooked names (`node.property.name`). Keep both projections.
  memberRaw := nodeText(s.ctx.File, access.Name())
  propertyCooked := identifierText(access.Name())

  var destructured *shimast.Node
  for index := len(matching) - 1; index >= 0; index-- {
    declaration := matching[index]
    if !s.declarationMatches(
      declaration,
      node,
      memberStart,
      memberVariableScope,
      memberRootName,
      memberRootSymbol,
      memberThisBoundary,
      propertyCooked,
    ) {
      continue
    }
    destructured = s.availableDestructuredMember(declaration, memberRaw, node)
    if destructured != nil {
      break
    }
  }
  if destructured == nil {
    return
  }
  if s.inTypeGuardedBranch(node) {
    return
  }
  if unicornConsistentDestructuringHasMemberParent(node) {
    // Upstream never offers to rewrite a nested member chain.
    s.ctx.Report(node, unicornConsistentDestructuringMessage)
    return
  }
  replacement := identifierText(destructured)
  s.ctx.ReportSuggestion(
    node,
    unicornConsistentDestructuringMessage,
    fmt.Sprintf(
      "Replace `%s` with destructured property `%s`.",
      nodeText(s.ctx.File, node),
      replacement,
    ),
    TextEdit{Pos: memberStart, End: node.End(), Text: replacement},
  )
}

// declarationMatches ports upstream's isMatchingDeclaration: order, shadowed
// roots, `this` boundaries, root reassignment, member reassignment, and
// scope containment.
func (s *unicornConsistentDestructuringState) declarationMatches(
  declaration *unicornConsistentDestructuringDeclaration,
  member *shimast.Node,
  memberStart int,
  memberVariableScope *shimast.Node,
  memberRootName string,
  memberRootSymbol *shimast.Symbol,
  memberThisBoundary *shimast.Node,
  propertyCooked string,
) bool {
  if declaration.objectEnd >= memberStart {
    return false
  }
  if declaration.rootName != "" && memberRootName == declaration.rootName &&
    memberRootSymbol != declaration.rootSymbol {
    return false
  }
  if declaration.thisBoundary != nil && memberThisBoundary != declaration.thisBoundary {
    return false
  }
  if s.rootVariableReassigned(declaration, memberStart, memberVariableScope) {
    return false
  }
  if s.memberExpressionReassigned(
    declaration,
    memberStart,
    memberVariableScope,
    propertyCooked,
    memberRootName,
    memberRootSymbol,
    memberThisBoundary,
  ) {
    return false
  }
  return unicornConsistentDestructuringIsAncestor(declaration.scope, member)
}

// rootVariableReassigned reports whether the declaration's root binding was
// written after the declaration and before the read — conservatively
// treating writes from other function scopes as always intervening, since a
// call or closure may run them between the two points.
func (s *unicornConsistentDestructuringState) rootVariableReassigned(
  declaration *unicornConsistentDestructuringDeclaration,
  memberStart int,
  memberVariableScope *shimast.Node,
) bool {
  if declaration.rootSymbol == nil {
    return false
  }
  for _, write := range s.rootWrites {
    if write.symbol != declaration.rootSymbol {
      continue
    }
    if write.start < declaration.objectEnd {
      continue
    }
    if write.variableScope != memberVariableScope {
      return true
    }
    if write.start <= memberStart {
      return true
    }
  }
  return false
}

// memberExpressionReassigned reports whether the same `<root>.<property>`
// member was written between the declaration and the read, with the same
// cross-function-scope conservatism as root reassignment.
func (s *unicornConsistentDestructuringState) memberExpressionReassigned(
  declaration *unicornConsistentDestructuringDeclaration,
  memberStart int,
  memberVariableScope *shimast.Node,
  propertyCooked string,
  memberRootName string,
  memberRootSymbol *shimast.Symbol,
  memberThisBoundary *shimast.Node,
) bool {
  for _, write := range s.memberWrites {
    if write.property != propertyCooked ||
      write.rootName != memberRootName ||
      write.rootSymbol != memberRootSymbol ||
      write.thisBoundary != memberThisBoundary {
      continue
    }
    if write.variableScope != memberVariableScope {
      return true
    }
    if write.start >= declaration.objectEnd && write.start <= memberStart {
      return true
    }
  }
  return false
}

// availableDestructuredMember finds the declaration's binding for the read
// property: a non-rest element with a plain identifier key, a plain
// identifier value, and no default, whose binding is still what the name
// resolves to at the read site (not shadowed in between).
func (s *unicornConsistentDestructuringState) availableDestructuredMember(
  declaration *unicornConsistentDestructuringDeclaration,
  memberRaw string,
  member *shimast.Node,
) *shimast.Node {
  pattern := declaration.pattern.AsBindingPattern()
  if pattern == nil || pattern.Elements == nil {
    return nil
  }
  for _, element := range pattern.Elements.Nodes {
    binding := element.AsBindingElement()
    if binding == nil || binding.DotDotDotToken != nil || binding.Initializer != nil {
      continue
    }
    value := binding.Name()
    if value == nil || value.Kind != shimast.KindIdentifier {
      continue
    }
    key := binding.PropertyName
    if key == nil {
      key = value
    }
    if key.Kind != shimast.KindIdentifier || identifierText(key) != memberRaw {
      continue
    }
    bindingSymbol := canonicalValueSymbol(s.ctx, value)
    if bindingSymbol == nil {
      continue
    }
    if s.resolveValueSymbol(identifierText(value), member) != bindingSymbol {
      continue
    }
    return value
  }
  return nil
}

// resolveValueSymbol resolves a name from the member read's lexical position
// — the checker equivalent of upstream's findVariable(memberScope, name) —
// normalized the same way canonicalValueSymbol normalizes declarations.
func (s *unicornConsistentDestructuringState) resolveValueSymbol(
  name string,
  location *shimast.Node,
) *shimast.Symbol {
  if s.ctx == nil || s.ctx.Checker == nil || name == "" || location == nil {
    return nil
  }
  symbol := s.ctx.Checker.ResolveName(name, location, shimast.SymbolFlagsValue, false /*excludeGlobals*/)
  if symbol == nil {
    return nil
  }
  if symbol.Flags&shimast.SymbolFlagsExportValue != 0 && symbol.ExportSymbol != nil {
    symbol = symbol.ExportSymbol
  }
  return s.ctx.Checker.GetMergedSymbol(symbol)
}

// shouldIgnoreMember ports upstream's shouldIgnoreMemberExpression plus its
// isLeftHandSide util. Element access never reaches here (only property
// accesses are collected), which subsumes the `computed` arm. Parentheses
// are transparent in the ESTree oracle, so relations are checked against the
// outermost paren wrapper.
func (s *unicornConsistentDestructuringState) shouldIgnoreMember(node *shimast.Node) bool {
  wrapped := skipParents(node)
  parent := wrapped.Parent
  if parent != nil {
    switch parent.Kind {
    case shimast.KindCallExpression:
      if call := parent.AsCallExpression(); call != nil && call.Expression == wrapped {
        return true
      }
    case shimast.KindNewExpression:
      if newExpression := parent.AsNewExpression(); newExpression != nil && newExpression.Expression == wrapped {
        return true
      }
    case shimast.KindTaggedTemplateExpression:
      // Replacing the tag would change the `this` binding, like a method
      // call.
      if tagged := parent.AsTaggedTemplateExpression(); tagged != nil && tagged.Tag == wrapped {
        return true
      }
    case shimast.KindBinaryExpression:
      binary := parent.AsBinaryExpression()
      if binary != nil && binary.OperatorToken != nil &&
        isAssignmentOperator(binary.OperatorToken.Kind) && binary.Left == wrapped {
        return true
      }
    case shimast.KindPrefixUnaryExpression:
      prefix := parent.AsPrefixUnaryExpression()
      if prefix != nil &&
        (prefix.Operator == shimast.KindPlusPlusToken || prefix.Operator == shimast.KindMinusMinusToken) &&
        prefix.Operand == wrapped {
        return true
      }
    case shimast.KindPostfixUnaryExpression:
      postfix := parent.AsPostfixUnaryExpression()
      if postfix != nil &&
        (postfix.Operator == shimast.KindPlusPlusToken || postfix.Operator == shimast.KindMinusMinusToken) &&
        postfix.Operand == wrapped {
        return true
      }
    case shimast.KindDeleteExpression:
      if deleted := parent.AsDeleteExpression(); deleted != nil && deleted.Expression == wrapped {
        return true
      }
    case shimast.KindArrayLiteralExpression:
      // ESTree's ArrayPattern-element arm: the read is a write slot only
      // when the containing literal is itself a destructuring target.
      return unicornConsistentDestructuringIsAssignmentPattern(parent)
    case shimast.KindSpreadElement:
      // ESTree's RestElement-argument arm; SpreadElement in expression
      // position (call arguments, plain array literals) is a read.
      if spread := parent.AsSpreadElement(); spread != nil && spread.Expression == wrapped {
        return unicornConsistentDestructuringIsAssignmentPattern(parent)
      }
    case shimast.KindSpreadAssignment:
      // Object-rest form of the RestElement-argument arm.
      if spread := parent.AsSpreadAssignment(); spread != nil && spread.Expression == wrapped {
        return unicornConsistentDestructuringIsAssignmentPattern(parent)
      }
    case shimast.KindPropertyAssignment:
      // ESTree's Property-value-in-ObjectPattern arm; the property name is
      // a read, and a value in a plain object literal is a read.
      if property := parent.AsPropertyAssignment(); property != nil && property.Initializer == wrapped {
        return unicornConsistentDestructuringIsAssignmentPattern(parent)
      }
    }
  }
  return false
}

// unicornConsistentDestructuringIsAssignmentPattern reports whether node (a
// pattern slot: array/object literal, spread, or property assignment) sits in
// a destructuring-assignment target position. This is the TypeScript-AST
// equivalent of ESTree spelling the containing literal as ArrayPattern /
// ObjectPattern: the walk ascends only through pattern edges (literal
// elements, property values, spreads, `=`-default lefts) and stops at
// anything else, so a literal in a computed index, call argument, or
// default-value position never counts.
func unicornConsistentDestructuringIsAssignmentPattern(node *shimast.Node) bool {
  for node != nil {
    parent := node.Parent
    if parent == nil {
      return false
    }
    switch parent.Kind {
    case shimast.KindBinaryExpression:
      // `[…] = value` anywhere is a destructuring assignment; `x = […]`
      // and pattern defaults keep the literal on the right, a read.
      binary := parent.AsBinaryExpression()
      return binary != nil && binary.OperatorToken != nil &&
        binary.OperatorToken.Kind == shimast.KindEqualsToken && binary.Left == node
    case shimast.KindForInStatement, shimast.KindForOfStatement:
      statement := parent.AsForInOrOfStatement()
      return statement != nil && statement.Initializer == node
    case shimast.KindArrayLiteralExpression, shimast.KindSpreadElement,
      shimast.KindSpreadAssignment, shimast.KindObjectLiteralExpression:
      node = parent
    case shimast.KindPropertyAssignment:
      property := parent.AsPropertyAssignment()
      if property == nil || property.Initializer != node {
        return false
      }
      node = parent
    default:
      return false
    }
  }
  return false
}

// inTypeGuardedBranch ports upstream's isInTypeGuardedBranch: a read inside
// the positive branch of a `'prop' in obj` test narrows the type, so the
// destructured binding is not equivalent. Class member boundaries stop the
// upward walk exactly as upstream's boundary list does.
func (s *unicornConsistentDestructuringState) inTypeGuardedBranch(node *shimast.Node) bool {
  child := node
  for parent := node.Parent; parent != nil; parent = parent.Parent {
    if unicornConsistentDestructuringIsGuardBoundary(parent) {
      return false
    }
    if s.inPositiveGuardBranch(parent, child, node) {
      return true
    }
    child = parent
  }
  return false
}

func (s *unicornConsistentDestructuringState) inPositiveGuardBranch(
  parent *shimast.Node,
  child *shimast.Node,
  member *shimast.Node,
) bool {
  switch parent.Kind {
  case shimast.KindConditionalExpression:
    conditional := parent.AsConditionalExpression()
    return conditional != nil && conditional.WhenTrue == child &&
      s.hasMatchingInExpression(conditional.Condition, member)
  case shimast.KindBinaryExpression:
    binary := parent.AsBinaryExpression()
    return binary != nil && binary.OperatorToken != nil &&
      binary.OperatorToken.Kind == shimast.KindAmpersandAmpersandToken &&
      binary.Right == child &&
      s.hasMatchingInExpression(binary.Left, member)
  case shimast.KindIfStatement:
    ifStatement := parent.AsIfStatement()
    return ifStatement != nil && ifStatement.ThenStatement == child &&
      s.hasMatchingInExpression(ifStatement.Expression, member)
  }
  return false
}

func (s *unicornConsistentDestructuringState) hasMatchingInExpression(
  node *shimast.Node,
  member *shimast.Node,
) bool {
  node = stripParens(node)
  if node == nil {
    return false
  }
  if s.matchesInExpression(node, member) {
    return true
  }
  if node.Kind != shimast.KindBinaryExpression {
    return false
  }
  binary := node.AsBinaryExpression()
  if binary == nil || binary.OperatorToken == nil ||
    binary.OperatorToken.Kind != shimast.KindAmpersandAmpersandToken {
    return false
  }
  return s.hasMatchingInExpression(binary.Left, member) ||
    s.hasMatchingInExpression(binary.Right, member)
}

// matchesInExpression recognizes `'name' in <object>` where name is the read
// property and the right side spells the same source text as the read's
// object (paren-stripped on both sides, since the ESTree oracle has no paren
// nodes).
func (s *unicornConsistentDestructuringState) matchesInExpression(
  node *shimast.Node,
  member *shimast.Node,
) bool {
  if node.Kind != shimast.KindBinaryExpression {
    return false
  }
  binary := node.AsBinaryExpression()
  if binary == nil || binary.OperatorToken == nil ||
    binary.OperatorToken.Kind != shimast.KindInKeyword {
    return false
  }
  left := stripParens(binary.Left)
  if left == nil || left.Kind != shimast.KindStringLiteral {
    return false
  }
  access := member.AsPropertyAccessExpression()
  if access == nil {
    return false
  }
  property := access.Name()
  if property == nil || property.Kind != shimast.KindIdentifier {
    return false
  }
  if stringLiteralText(left) != identifierText(property) {
    return false
  }
  return nodeText(s.ctx.File, stripParens(binary.Right)) ==
    nodeText(s.ctx.File, stripParens(access.Expression))
}

// unicornConsistentDestructuringIsGuardBoundary mirrors upstream's
// isInTypeGuardBoundary set: function declarations, class fields (including
// accessor fields), and class methods. Object-literal methods intentionally
// pass through — ESTree walks their FunctionExpression, which is not a
// boundary.
func unicornConsistentDestructuringIsGuardBoundary(node *shimast.Node) bool {
  switch node.Kind {
  case shimast.KindFunctionDeclaration, shimast.KindPropertyDeclaration:
    return true
  case shimast.KindMethodDeclaration, shimast.KindGetAccessor,
    shimast.KindSetAccessor, shimast.KindConstructor:
    return node.Parent != nil &&
      (node.Parent.Kind == shimast.KindClassDeclaration ||
        node.Parent.Kind == shimast.KindClassExpression)
  }
  return false
}

// unicornConsistentDestructuringHasMemberParent decides whether the ESTree
// parent of the read would itself be a MemberExpression, in which case
// upstream reports without a suggestion. Parentheses do not exist in ESTree,
// so they are skipped — except that a parenthesized (or computed-argument)
// optional chain is capped by a ChainExpression wrapper upstream and
// therefore does get a suggestion.
func unicornConsistentDestructuringHasMemberParent(node *shimast.Node) bool {
  wrapped := node
  passedParens := false
  for wrapped.Parent != nil && wrapped.Parent.Kind == shimast.KindParenthesizedExpression {
    wrapped = wrapped.Parent
    passedParens = true
  }
  parent := wrapped.Parent
  if parent == nil {
    return false
  }
  objectPosition := false
  switch parent.Kind {
  case shimast.KindPropertyAccessExpression:
    access := parent.AsPropertyAccessExpression()
    if access == nil || access.Expression != wrapped {
      return false
    }
    objectPosition = true
  case shimast.KindElementAccessExpression:
    access := parent.AsElementAccessExpression()
    if access == nil {
      return false
    }
    objectPosition = access.Expression == wrapped
    if !objectPosition && access.ArgumentExpression != wrapped {
      return false
    }
  default:
    return false
  }
  if node.Flags&shimast.NodeFlagsOptionalChain != 0 {
    // A ChainExpression caps the optional chain unless the outer access
    // continues the same chain in object position.
    if passedParens || !objectPosition {
      return false
    }
    return parent.Flags&shimast.NodeFlagsOptionalChain != 0
  }
  return true
}

// unicornConsistentDestructuringUnwrapObject unwraps parentheses and
// TypeScript assertion wrappers, the union of ESTree's paren transparency
// and upstream's unwrapTypeScriptExpression.
func unicornConsistentDestructuringUnwrapObject(node *shimast.Node) *shimast.Node {
  for node != nil {
    switch node.Kind {
    case shimast.KindParenthesizedExpression:
      node = node.AsParenthesizedExpression().Expression
    case shimast.KindAsExpression:
      node = node.AsAsExpression().Expression
    case shimast.KindSatisfiesExpression:
      node = node.AsSatisfiesExpression().Expression
    case shimast.KindNonNullExpression:
      node = node.AsNonNullExpression().Expression
    case shimast.KindTypeAssertionExpression:
      node = node.AsTypeAssertion().Expression
    default:
      return node
    }
  }
  return nil
}

// unicornConsistentDestructuringIsJsxTagName reports whether the property
// access spells (part of) a JSX element tag name. ESTree types those as
// JSXMemberExpression, which upstream's MemberExpression listener never
// sees.
func unicornConsistentDestructuringIsJsxTagName(node *shimast.Node) bool {
  current := node
  for current.Parent != nil && current.Parent.Kind == shimast.KindPropertyAccessExpression {
    access := current.Parent.AsPropertyAccessExpression()
    if access == nil || access.Expression != current {
      return false
    }
    current = current.Parent
  }
  parent := current.Parent
  if parent == nil {
    return false
  }
  switch parent.Kind {
  case shimast.KindJsxOpeningElement, shimast.KindJsxClosingElement,
    shimast.KindJsxSelfClosingElement:
    return true
  }
  return false
}

// unicornConsistentDestructuringNearestScope returns the nearest
// scope-creating ancestor. A read matches a declaration only when the read
// sits inside this node, which is the AST equivalent of eslint-scope's
// child-scope chain containment.
func unicornConsistentDestructuringNearestScope(node *shimast.Node) *shimast.Node {
  for current := node.Parent; current != nil; current = current.Parent {
    switch current.Kind {
    case shimast.KindSourceFile, shimast.KindBlock, shimast.KindModuleBlock,
      shimast.KindCaseBlock, shimast.KindCatchClause,
      shimast.KindForStatement, shimast.KindForInStatement, shimast.KindForOfStatement,
      shimast.KindFunctionDeclaration, shimast.KindFunctionExpression, shimast.KindArrowFunction,
      shimast.KindMethodDeclaration, shimast.KindGetAccessor, shimast.KindSetAccessor,
      shimast.KindConstructor, shimast.KindClassStaticBlockDeclaration,
      shimast.KindClassDeclaration, shimast.KindClassExpression,
      shimast.KindPropertyDeclaration, shimast.KindEnumDeclaration, shimast.KindModuleDeclaration:
      return current
    }
  }
  return nil
}

// unicornConsistentDestructuringVariableScope returns the nearest
// function-like scope — eslint-scope's variableScope — used by the
// conservative cross-scope write checks.
func unicornConsistentDestructuringVariableScope(node *shimast.Node) *shimast.Node {
  for current := node.Parent; current != nil; current = current.Parent {
    switch current.Kind {
    case shimast.KindSourceFile,
      shimast.KindFunctionDeclaration, shimast.KindFunctionExpression, shimast.KindArrowFunction,
      shimast.KindMethodDeclaration, shimast.KindGetAccessor, shimast.KindSetAccessor,
      shimast.KindConstructor, shimast.KindClassStaticBlockDeclaration,
      shimast.KindPropertyDeclaration, shimast.KindEnumDeclaration, shimast.KindModuleDeclaration:
      return current
    }
  }
  return nil
}

// unicornConsistentDestructuringThisBoundary returns the node that owns the
// `this` binding at `node`. Arrow functions inherit `this` and are
// deliberately absent, matching upstream's boundary list.
func unicornConsistentDestructuringThisBoundary(node *shimast.Node) *shimast.Node {
  for current := node.Parent; current != nil; current = current.Parent {
    switch current.Kind {
    case shimast.KindSourceFile,
      shimast.KindFunctionDeclaration, shimast.KindFunctionExpression,
      shimast.KindMethodDeclaration, shimast.KindGetAccessor, shimast.KindSetAccessor,
      shimast.KindConstructor, shimast.KindPropertyDeclaration,
      shimast.KindClassStaticBlockDeclaration:
      return current
    }
  }
  return nil
}

// unicornConsistentDestructuringIsAncestor reports whether scope is an
// ancestor of node.
func unicornConsistentDestructuringIsAncestor(scope *shimast.Node, node *shimast.Node) bool {
  if scope == nil || node == nil {
    return false
  }
  for current := node.Parent; current != nil; current = current.Parent {
    if current == scope {
      return true
    }
  }
  return false
}

func init() {
  Register(unicornConsistentDestructuring{})
}
