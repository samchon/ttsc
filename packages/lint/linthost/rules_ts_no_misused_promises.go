// typescript/no-misused-promises rejects thenables used as booleans and
// Promise-returning functions supplied to contracts that discard their
// return value. Every void-return check is driven by the Checker's resolved
// types; callback syntax and callee spelling are never used as substitutes
// for the destination contract.
package linthost

import (
  "encoding/json"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimchecker "github.com/microsoft/typescript-go/shim/checker"
)

type noMisusedPromises struct{}

type noMisusedPromisesRawOptions struct {
  ChecksConditionals *bool           `json:"checksConditionals"`
  ChecksSpreads      *bool           `json:"checksSpreads"`
  ChecksVoidReturn   json.RawMessage `json:"checksVoidReturn"`
}

type noMisusedPromisesVoidOptions struct {
  Arguments        *bool `json:"arguments"`
  Attributes       *bool `json:"attributes"`
  InheritedMethods *bool `json:"inheritedMethods"`
  Properties       *bool `json:"properties"`
  Returns          *bool `json:"returns"`
  Variables        *bool `json:"variables"`
}

type noMisusedPromisesOptions struct {
  checksConditionals bool
  checksSpreads      bool
  arguments          bool
  attributes         bool
  inheritedMethods   bool
  properties         bool
  returns            bool
  variables          bool
}

func init() { Register(noMisusedPromises{}) }

func (noMisusedPromises) Name() string { return "typescript/no-misused-promises" }
func (noMisusedPromises) NeedsTypeChecker() bool {
  return true
}
func (noMisusedPromises) Visits() []shimast.Kind {
  return []shimast.Kind{
    shimast.KindIfStatement,
    shimast.KindWhileStatement,
    shimast.KindDoStatement,
    shimast.KindForStatement,
    shimast.KindConditionalExpression,
    shimast.KindPrefixUnaryExpression,
    shimast.KindBinaryExpression,
    shimast.KindCallExpression,
    shimast.KindNewExpression,
    shimast.KindSpreadAssignment,
    shimast.KindVariableDeclaration,
    shimast.KindPropertyAssignment,
    shimast.KindShorthandPropertyAssignment,
    shimast.KindMethodDeclaration,
    shimast.KindReturnStatement,
    shimast.KindJsxAttribute,
    shimast.KindClassDeclaration,
    shimast.KindClassExpression,
    shimast.KindInterfaceDeclaration,
  }
}

func (noMisusedPromises) Check(ctx *Context, node *shimast.Node) {
  if ctx == nil || ctx.Checker == nil || node == nil {
    return
  }
  options := noMisusedPromisesResolveOptions(ctx)
  switch node.Kind {
  case shimast.KindIfStatement:
    if options.checksConditionals {
      if statement := node.AsIfStatement(); statement != nil {
        noMisusedPromisesCheckConditional(ctx, statement.Expression, true)
      }
    }
  case shimast.KindWhileStatement:
    if options.checksConditionals {
      if statement := node.AsWhileStatement(); statement != nil {
        noMisusedPromisesCheckConditional(ctx, statement.Expression, true)
      }
    }
  case shimast.KindDoStatement:
    if options.checksConditionals {
      if statement := node.AsDoStatement(); statement != nil {
        noMisusedPromisesCheckConditional(ctx, statement.Expression, true)
      }
    }
  case shimast.KindForStatement:
    if options.checksConditionals {
      if statement := node.AsForStatement(); statement != nil {
        noMisusedPromisesCheckConditional(ctx, statement.Condition, true)
      }
    }
  case shimast.KindConditionalExpression:
    if options.checksConditionals {
      if expression := node.AsConditionalExpression(); expression != nil {
        noMisusedPromisesCheckConditional(ctx, expression.Condition, true)
      }
    }
  case shimast.KindPrefixUnaryExpression:
    if options.checksConditionals && !noMisusedPromisesConditionalOwnedByAncestor(node) {
      if expression := node.AsPrefixUnaryExpression(); expression != nil && expression.Operator == shimast.KindExclamationToken {
        noMisusedPromisesCheckConditional(ctx, expression.Operand, true)
      }
    }
  case shimast.KindBinaryExpression:
    noMisusedPromisesCheckBinary(ctx, node, options)
  case shimast.KindCallExpression, shimast.KindNewExpression:
    var predicateArgument *shimast.Node
    if options.checksConditionals {
      predicateArgument = noMisusedPromisesCheckPredicate(ctx, node)
    }
    if options.arguments {
      noMisusedPromisesCheckArguments(ctx, node, predicateArgument)
    }
  case shimast.KindSpreadAssignment:
    if options.checksSpreads {
      noMisusedPromisesCheckSpread(ctx, node)
    }
  case shimast.KindVariableDeclaration:
    if options.variables {
      noMisusedPromisesCheckVariable(ctx, node)
    }
  case shimast.KindPropertyAssignment, shimast.KindShorthandPropertyAssignment, shimast.KindMethodDeclaration:
    if options.properties {
      noMisusedPromisesCheckProperty(ctx, node)
    }
  case shimast.KindReturnStatement:
    if options.returns {
      noMisusedPromisesCheckReturn(ctx, node)
    }
  case shimast.KindJsxAttribute:
    if options.attributes {
      noMisusedPromisesCheckAttribute(ctx, node)
    }
  case shimast.KindClassDeclaration, shimast.KindClassExpression, shimast.KindInterfaceDeclaration:
    if options.inheritedMethods {
      noMisusedPromisesCheckInheritedMethods(ctx, node)
    }
  }
}

func noMisusedPromisesResolveOptions(ctx *Context) noMisusedPromisesOptions {
  resolved := noMisusedPromisesOptions{
    checksConditionals: true,
    checksSpreads:      true,
    arguments:          true,
    attributes:         true,
    inheritedMethods:   true,
    properties:         true,
    returns:            true,
    variables:          true,
  }
  var raw noMisusedPromisesRawOptions
  if ctx.DecodeOptions(&raw) != nil {
    return resolved
  }
  if raw.ChecksConditionals != nil {
    resolved.checksConditionals = *raw.ChecksConditionals
  }
  if raw.ChecksSpreads != nil {
    resolved.checksSpreads = *raw.ChecksSpreads
  }
  if len(raw.ChecksVoidReturn) == 0 {
    return resolved
  }
  var enabled bool
  if json.Unmarshal(raw.ChecksVoidReturn, &enabled) == nil {
    resolved.arguments = enabled
    resolved.attributes = enabled
    resolved.inheritedMethods = enabled
    resolved.properties = enabled
    resolved.returns = enabled
    resolved.variables = enabled
    return resolved
  }
  var positions noMisusedPromisesVoidOptions
  if json.Unmarshal(raw.ChecksVoidReturn, &positions) != nil {
    return resolved
  }
  noMisusedPromisesSetOption(&resolved.arguments, positions.Arguments)
  noMisusedPromisesSetOption(&resolved.attributes, positions.Attributes)
  noMisusedPromisesSetOption(&resolved.inheritedMethods, positions.InheritedMethods)
  noMisusedPromisesSetOption(&resolved.properties, positions.Properties)
  noMisusedPromisesSetOption(&resolved.returns, positions.Returns)
  noMisusedPromisesSetOption(&resolved.variables, positions.Variables)
  return resolved
}

func noMisusedPromisesSetOption(target *bool, configured *bool) {
  if configured != nil {
    *target = *configured
  }
}

func noMisusedPromisesCheckBinary(ctx *Context, node *shimast.Node, options noMisusedPromisesOptions) {
  expression := node.AsBinaryExpression()
  if expression == nil || expression.OperatorToken == nil {
    return
  }
  switch expression.OperatorToken.Kind {
  case shimast.KindAmpersandAmpersandToken, shimast.KindBarBarToken, shimast.KindQuestionQuestionToken:
    if options.checksConditionals && !noMisusedPromisesConditionalOwnedByAncestor(node) {
      noMisusedPromisesCheckConditional(ctx, node, false)
    }
  case shimast.KindEqualsToken:
    if options.variables &&
      noMisusedPromisesIsVoidReturningFunctionType(ctx.Checker, expression.Left, ctx.Checker.GetTypeAtLocation(expression.Left)) &&
      noMisusedPromisesReturnsThenable(ctx.Checker, expression.Right) {
      ctx.Report(expression.Right, "Promise-returning function assigned where a void return was expected.")
    }
  }
}

func noMisusedPromisesConditionalOwnedByAncestor(node *shimast.Node) bool {
  owned, _ := noMisusedPromisesConditionalContextFromAncestor(node)
  return owned
}

// noMisusedPromisesConditionalContextFromAncestor mirrors the upstream
// checked-node set without retaining state between Check calls. It reports
// whether an ancestor's recursive conditional walk reaches node and whether
// that walk is inside a test expression.
func noMisusedPromisesConditionalContextFromAncestor(node *shimast.Node) (bool, bool) {
  child := node
  for parent := node.Parent; parent != nil; parent = parent.Parent {
    if parent.Kind == shimast.KindParenthesizedExpression {
      child = parent
      continue
    }
    switch parent.Kind {
    case shimast.KindPrefixUnaryExpression:
      expression := parent.AsPrefixUnaryExpression()
      if expression != nil && expression.Operator == shimast.KindExclamationToken && expression.Operand == child {
        return true, true
      }
      return false, false
    case shimast.KindBinaryExpression:
      expression := parent.AsBinaryExpression()
      if expression == nil || expression.OperatorToken == nil {
        return false, false
      }
      switch expression.OperatorToken.Kind {
      case shimast.KindAmpersandAmpersandToken, shimast.KindBarBarToken, shimast.KindQuestionQuestionToken:
        parentOwned, testExpression := noMisusedPromisesConditionalContextFromAncestor(parent)
        if !parentOwned {
          testExpression = false
        }
        if expression.Left == child {
          return expression.OperatorToken.Kind != shimast.KindQuestionQuestionToken || testExpression, testExpression
        }
        if expression.Right == child {
          return testExpression, testExpression
        }
        return false, false
      }
      return false, false
    case shimast.KindConditionalExpression:
      expression := parent.AsConditionalExpression()
      return expression != nil && expression.Condition == child, true
    case shimast.KindIfStatement:
      statement := parent.AsIfStatement()
      return statement != nil && statement.Expression == child, true
    case shimast.KindWhileStatement:
      statement := parent.AsWhileStatement()
      return statement != nil && statement.Expression == child, true
    case shimast.KindDoStatement:
      statement := parent.AsDoStatement()
      return statement != nil && statement.Expression == child, true
    case shimast.KindForStatement:
      statement := parent.AsForStatement()
      return statement != nil && statement.Condition == child, true
    }
    return false, false
  }
  return false, false
}

func noMisusedPromisesCheckConditional(ctx *Context, expression *shimast.Node, testExpression bool) {
  expression = stripParens(expression)
  if expression == nil {
    return
  }
  if expression.Kind == shimast.KindBinaryExpression {
    binary := expression.AsBinaryExpression()
    if binary == nil || binary.OperatorToken == nil {
      return
    }
    switch binary.OperatorToken.Kind {
    case shimast.KindAmpersandAmpersandToken, shimast.KindBarBarToken, shimast.KindQuestionQuestionToken:
      if binary.OperatorToken.Kind != shimast.KindQuestionQuestionToken || testExpression {
        noMisusedPromisesCheckConditional(ctx, binary.Left, testExpression)
      }
      if testExpression {
        noMisusedPromisesCheckConditional(ctx, binary.Right, true)
      }
      return
    }
  }
  if expression.Kind == shimast.KindPrefixUnaryExpression {
    if prefix := expression.AsPrefixUnaryExpression(); prefix != nil && prefix.Operator == shimast.KindExclamationToken {
      noMisusedPromisesCheckConditional(ctx, prefix.Operand, true)
      return
    }
  }
  if noMisusedPromisesIsAlwaysThenable(ctx.Checker, expression) {
    ctx.Report(expression, "Expected a non-Promise value in a boolean conditional.")
  }
}

func noMisusedPromisesIsAlwaysThenable(checker *shimchecker.Checker, node *shimast.Node) bool {
  if checker == nil || node == nil {
    return false
  }
  valueType := constrainedPromiseType(checker, checker.GetTypeAtLocation(node))
  apparent := checker.GetApparentType(valueType)
  parts := promiseUnionParts(apparent)
  if len(parts) == 0 {
    return false
  }
  for _, part := range parts {
    if !isThenableAtLocation(checker, node, part) {
      return false
    }
  }
  return true
}

func noMisusedPromisesCheckPredicate(ctx *Context, node *shimast.Node) *shimast.Node {
  if node.Kind != shimast.KindCallExpression {
    return nil
  }
  call := node.AsCallExpression()
  if call == nil || call.Arguments == nil || len(call.Arguments.Nodes) == 0 {
    return nil
  }
  receiver, method, ok := noMisusedPromisesStaticMemberParts(call.Expression)
  if !ok || !noMisusedPromisesIsArrayPredicate(method) || !noMisusedPromisesHasNativeArrayReceiver(ctx.Checker, receiver) {
    return nil
  }
  callback := call.Arguments.Nodes[0]
  if noMisusedPromisesReturnsThenable(ctx.Checker, callback) {
    ctx.Report(callback, "Expected a non-Promise value to be returned from this predicate.")
    return callback
  }
  return nil
}

func noMisusedPromisesIsArrayPredicate(method string) bool {
  switch method {
  case "every", "filter", "find", "findIndex", "findLast", "findLastIndex", "some":
    return true
  }
  return false
}

func noMisusedPromisesStaticMemberParts(node *shimast.Node) (*shimast.Node, string, bool) {
  node = stripParens(node)
  if node == nil {
    return nil, "", false
  }
  switch node.Kind {
  case shimast.KindPropertyAccessExpression:
    access := node.AsPropertyAccessExpression()
    if access == nil {
      return nil, "", false
    }
    method := identifierText(access.Name())
    return access.Expression, method, method != ""
  case shimast.KindElementAccessExpression:
    access := node.AsElementAccessExpression()
    if access == nil || access.ArgumentExpression == nil {
      return nil, "", false
    }
    argument := stripParens(access.ArgumentExpression)
    if argument == nil {
      return nil, "", false
    }
    switch argument.Kind {
    case shimast.KindStringLiteral, shimast.KindNoSubstitutionTemplateLiteral:
      method := stringLiteralText(argument)
      return access.Expression, method, method != ""
    }
  }
  return nil, "", false
}

func noMisusedPromisesHasNativeArrayReceiver(checker *shimchecker.Checker, node *shimast.Node) bool {
  if checker == nil || node == nil {
    return false
  }
  return noMisusedPromisesTypeHasNativeArray(
    checker,
    checker.GetTypeAtLocation(node),
    map[*shimchecker.Type]struct{}{},
  )
}

func noMisusedPromisesTypeHasNativeArray(
  checker *shimchecker.Checker,
  valueType *shimchecker.Type,
  seen map[*shimchecker.Type]struct{},
) bool {
  if checker == nil || valueType == nil {
    return false
  }
  if _, ok := seen[valueType]; ok {
    return false
  }
  seen[valueType] = struct{}{}
  defer delete(seen, valueType)

  flags := valueType.Flags()
  if flags&shimchecker.TypeFlagsTypeParameter != 0 {
    constraint := checker.GetBaseConstraintOfType(valueType)
    return constraint != nil && constraint != valueType &&
      noMisusedPromisesTypeHasNativeArray(checker, constraint, seen)
  }
  if flags&(shimchecker.TypeFlagsUnion|shimchecker.TypeFlagsIntersection) != 0 {
    for _, part := range valueType.Types() {
      if noMisusedPromisesTypeHasNativeArray(checker, part, seen) {
        return true
      }
    }
    return false
  }
  return shimchecker.Checker_isArrayType(checker, valueType) || shimchecker.IsTupleType(valueType)
}

func noMisusedPromisesCheckArguments(ctx *Context, node, predicateArgument *shimast.Node) {
  expression, arguments, signatureKind := noMisusedPromisesCallParts(node)
  if expression == nil || len(arguments) == 0 || noMisusedPromisesIsPromiseFinally(ctx.Checker, node, expression) {
    return
  }
  calleeType := ctx.Checker.GetApparentType(ctx.Checker.GetTypeAtLocation(expression))
  for index, argument := range arguments {
    if argument == predicateArgument {
      continue
    }
    acceptsThenable := false
    acceptsVoid := false
    classify := func(target *shimchecker.Type) {
      if target == nil {
        return
      }
      if noMisusedPromisesIsThenableReturningFunctionType(ctx.Checker, node, target) {
        acceptsThenable = true
      } else if noMisusedPromisesIsVoidReturningFunctionType(ctx.Checker, node, target) {
        acceptsVoid = true
      }
    }
    for _, part := range promiseUnionParts(calleeType) {
      for _, signature := range ctx.Checker.GetSignaturesOfType(part, signatureKind) {
        classify(noMisusedPromisesParameterTypeAt(ctx.Checker, expression, signature, index))
      }
    }
    // The declared signatures are authoritative. Contextual typing is only a
    // fallback for checker-instantiated positions that are not recoverable
    // from those signatures. Classifying it eagerly would mistake an inferred
    // `T = () => Promise<void>` for permission when the declaration says
    // `T extends () => void`.
    if !acceptsThenable && !acceptsVoid {
      classify(ctx.Checker.GetContextualTypeForArgumentAtIndex(node, index))
    }
    if acceptsVoid && !acceptsThenable && noMisusedPromisesReturnsThenable(ctx.Checker, argument) {
      ctx.Report(argument, "Promise returned in a function argument where a void return was expected.")
    }
  }
}

func noMisusedPromisesCallParts(node *shimast.Node) (*shimast.Node, []*shimast.Node, shimchecker.SignatureKind) {
  if node.Kind == shimast.KindCallExpression {
    call := node.AsCallExpression()
    if call == nil {
      return nil, nil, shimchecker.SignatureKindCall
    }
    if call.Arguments == nil {
      return call.Expression, nil, shimchecker.SignatureKindCall
    }
    return call.Expression, call.Arguments.Nodes, shimchecker.SignatureKindCall
  }
  if node.Kind == shimast.KindNewExpression {
    construct := node.AsNewExpression()
    if construct == nil {
      return nil, nil, shimchecker.SignatureKindConstruct
    }
    if construct.Arguments == nil {
      return construct.Expression, nil, shimchecker.SignatureKindConstruct
    }
    return construct.Expression, construct.Arguments.Nodes, shimchecker.SignatureKindConstruct
  }
  return nil, nil, shimchecker.SignatureKindCall
}

func noMisusedPromisesParameterTypeAt(
  checker *shimchecker.Checker,
  location *shimast.Node,
  signature *shimchecker.Signature,
  index int,
) *shimchecker.Type {
  parameters := shimchecker.Signature_parameters(signature)
  if len(parameters) == 0 {
    return nil
  }
  last := len(parameters) - 1
  if shimchecker.Signature_hasRestParameter(signature) && index >= last {
    restType := constrainedPromiseType(
      checker,
      shimchecker.Checker_getTypeOfSymbolAtLocation(checker, parameters[last], location),
    )
    if restType != nil && shimchecker.IsTupleType(restType) {
      elements := checker.GetTypeArguments(restType)
      offset := index - last
      if offset >= len(elements) {
        return nil
      }
      return elements[offset]
    }
    return shimchecker.Checker_getRestTypeOfSignature(checker, signature)
  }
  if index >= len(parameters) {
    return nil
  }
  return shimchecker.Checker_getTypeOfSymbolAtLocation(checker, parameters[index], location)
}

func noMisusedPromisesIsPromiseFinally(checker *shimchecker.Checker, node, expression *shimast.Node) bool {
  if node.Kind != shimast.KindCallExpression {
    return false
  }
  receiver, method, ok := promisePropertyAccessParts(expression)
  if !ok || method != "finally" || receiver == nil {
    return false
  }
  return isPromiseTypedExpression(checker, checker.GetTypeAtLocation(receiver))
}

func noMisusedPromisesCheckSpread(ctx *Context, node *shimast.Node) {
  spread := node.AsSpreadAssignment()
  if spread != nil && spread.Expression != nil && noMisusedPromisesIsSometimesThenable(ctx.Checker, spread.Expression) {
    ctx.Report(spread.Expression, "Expected a non-Promise value to be spread in an object.")
  }
}

func noMisusedPromisesIsSometimesThenable(checker *shimchecker.Checker, node *shimast.Node) bool {
  if checker == nil || node == nil {
    return false
  }
  valueType := checker.GetApparentType(constrainedPromiseType(checker, checker.GetTypeAtLocation(node)))
  for _, part := range promiseUnionParts(valueType) {
    if isThenableAtLocation(checker, node, part) {
      return true
    }
  }
  return false
}

func noMisusedPromisesCheckVariable(ctx *Context, node *shimast.Node) {
  declaration := node.AsVariableDeclaration()
  if declaration == nil || declaration.Initializer == nil {
    return
  }
  if noMisusedPromisesIsSyncUsingDeclaration(node) && noMisusedPromisesHasThenableDispose(ctx.Checker, declaration.Initializer) {
    ctx.Report(declaration.Initializer, "Synchronous disposal cannot observe a Promise returned by `Symbol.dispose`.")
    return
  }
  if declaration.Type == nil || declaration.Name() == nil {
    return
  }
  targetType := ctx.Checker.GetTypeAtLocation(declaration.Name())
  if noMisusedPromisesHasVoidDispose(ctx.Checker, declaration.Name(), targetType) &&
    noMisusedPromisesHasThenableDispose(ctx.Checker, declaration.Initializer) {
    ctx.Report(declaration.Initializer, "Promise-returning `Symbol.dispose` assigned where synchronous disposal was expected.")
    return
  }
  if noMisusedPromisesIsVoidReturningFunctionType(ctx.Checker, declaration.Initializer, targetType) &&
    noMisusedPromisesReturnsThenable(ctx.Checker, declaration.Initializer) {
    ctx.Report(declaration.Initializer, "Promise-returning function assigned to a variable where a void return was expected.")
  }
}

func noMisusedPromisesIsSyncUsingDeclaration(node *shimast.Node) bool {
  if node == nil || node.Parent == nil || node.Parent.Kind != shimast.KindVariableDeclarationList {
    return false
  }
  flags := shimast.GetCombinedNodeFlags(node.Parent) & shimast.NodeFlagsBlockScoped
  return flags == shimast.NodeFlagsUsing
}

func noMisusedPromisesHasThenableDispose(checker *shimchecker.Checker, initializer *shimast.Node) bool {
  if checker == nil || initializer == nil {
    return false
  }
  propertyName := shimchecker.Checker_getPropertyNameForKnownSymbolName(checker, "dispose")
  if propertyName == "" {
    return false
  }
  valueType := checker.GetApparentType(checker.GetTypeAtLocation(initializer))
  for _, part := range promiseUnionParts(valueType) {
    property := checker.GetPropertyOfType(part, propertyName)
    if property == nil {
      continue
    }
    propertyType := shimchecker.Checker_getTypeOfSymbolAtLocation(checker, property, initializer)
    if noMisusedPromisesIsThenableReturningFunctionType(checker, initializer, propertyType) {
      return true
    }
  }
  return false
}

func noMisusedPromisesHasVoidDispose(
  checker *shimchecker.Checker,
  location *shimast.Node,
  valueType *shimchecker.Type,
) bool {
  if checker == nil || location == nil || valueType == nil {
    return false
  }
  propertyName := shimchecker.Checker_getPropertyNameForKnownSymbolName(checker, "dispose")
  if propertyName == "" {
    return false
  }
  valueType = checker.GetApparentType(constrainedPromiseType(checker, valueType))
  for _, part := range promiseUnionParts(valueType) {
    property := checker.GetPropertyOfType(part, propertyName)
    if property == nil {
      continue
    }
    propertyType := shimchecker.Checker_getTypeOfSymbolAtLocation(checker, property, location)
    if noMisusedPromisesIsVoidReturningFunctionType(checker, location, propertyType) {
      return true
    }
  }
  return false
}

func noMisusedPromisesCheckProperty(ctx *Context, node *shimast.Node) {
  if node.Parent == nil || node.Parent.Kind != shimast.KindObjectLiteralExpression {
    return
  }
  var value *shimast.Node
  switch node.Kind {
  case shimast.KindPropertyAssignment:
    if property := node.AsPropertyAssignment(); property != nil {
      value = property.Initializer
    }
  case shimast.KindShorthandPropertyAssignment:
    if property := node.AsShorthandPropertyAssignment(); property != nil {
      value = property.Name()
    }
  case shimast.KindMethodDeclaration:
    if name := node.Name(); name != nil && name.Kind == shimast.KindComputedPropertyName {
      return
    }
    value = node
  }
  if value == nil {
    return
  }
  targetType := ctx.Checker.GetContextualTypeForObjectLiteralElement(node, 0)
  if noMisusedPromisesIsVoidReturningFunctionType(ctx.Checker, value, targetType) &&
    noMisusedPromisesReturnsThenable(ctx.Checker, value) {
    ctx.Report(value, "Promise-returning function provided to a property where a void return was expected.")
  }
}

func noMisusedPromisesCheckReturn(ctx *Context, node *shimast.Node) {
  statement := node.AsReturnStatement()
  if statement == nil || statement.Expression == nil {
    return
  }
  targetType := ctx.Checker.GetContextualType(statement.Expression, 0)
  if noMisusedPromisesIsVoidReturningFunctionType(ctx.Checker, statement.Expression, targetType) &&
    noMisusedPromisesReturnsThenable(ctx.Checker, statement.Expression) {
    ctx.Report(statement.Expression, "Promise-returning function returned where a void return was expected.")
  }
}

func noMisusedPromisesCheckAttribute(ctx *Context, node *shimast.Node) {
  attribute := node.AsJsxAttribute()
  if attribute == nil || attribute.Initializer == nil || attribute.Initializer.Kind != shimast.KindJsxExpression {
    return
  }
  container := attribute.Initializer.AsJsxExpression()
  if container == nil || container.Expression == nil {
    return
  }
  targetType := ctx.Checker.GetContextualTypeForJsxAttribute(node)
  if noMisusedPromisesIsVoidReturningFunctionType(ctx.Checker, container.Expression, targetType) &&
    noMisusedPromisesReturnsThenable(ctx.Checker, container.Expression) {
    ctx.Report(container.Expression, "Promise-returning function provided to an attribute where a void return was expected.")
  }
}

func noMisusedPromisesCheckInheritedMethods(ctx *Context, node *shimast.Node) {
  members, heritage := noMisusedPromisesClassParts(node)
  for _, member := range members {
    if member == nil || member.Name() == nil || hasModifier(member, shimast.KindStaticKeyword) ||
      !noMisusedPromisesReturnsThenable(ctx.Checker, member) {
      continue
    }
    name, ok := noUnsafeAssignmentPropertyName(member.Name())
    if !ok {
      continue
    }
    for _, typeNode := range heritage {
      baseType := ctx.Checker.GetTypeAtLocation(typeNode)
      property := ctx.Checker.GetPropertyOfType(baseType, name)
      if property == nil {
        continue
      }
      targetType := shimchecker.Checker_getTypeOfSymbolAtLocation(ctx.Checker, property, member)
      if noMisusedPromisesIsVoidReturningFunctionType(ctx.Checker, member, targetType) {
        ctx.Report(member, "Promise-returning method overrides an inherited method where a void return was expected.")
        break
      }
    }
  }
}

func noMisusedPromisesClassParts(node *shimast.Node) ([]*shimast.Node, []*shimast.Node) {
  var members *shimast.NodeList
  var clauses *shimast.NodeList
  switch node.Kind {
  case shimast.KindClassDeclaration:
    if declaration := node.AsClassDeclaration(); declaration != nil {
      members = declaration.Members
      clauses = declaration.HeritageClauses
    }
  case shimast.KindClassExpression:
    if declaration := node.AsClassExpression(); declaration != nil {
      members = declaration.Members
      clauses = declaration.HeritageClauses
    }
  case shimast.KindInterfaceDeclaration:
    if declaration := node.AsInterfaceDeclaration(); declaration != nil {
      members = declaration.Members
      clauses = declaration.HeritageClauses
    }
  }
  var memberNodes []*shimast.Node
  if members != nil {
    memberNodes = members.Nodes
  }
  heritage := make([]*shimast.Node, 0)
  if clauses != nil {
    for _, clauseNode := range clauses.Nodes {
      clause := clauseNode.AsHeritageClause()
      if clause != nil && clause.Types != nil {
        heritage = append(heritage, clause.Types.Nodes...)
      }
    }
  }
  return memberNodes, heritage
}

func noMisusedPromisesReturnsThenable(checker *shimchecker.Checker, node *shimast.Node) bool {
  if checker == nil || node == nil {
    return false
  }
  valueType := checker.GetApparentType(checker.GetTypeAtLocation(stripParens(node)))
  return noMisusedPromisesIsThenableReturningFunctionType(checker, node, valueType)
}

func noMisusedPromisesIsThenableReturningFunctionType(
  checker *shimchecker.Checker,
  location *shimast.Node,
  valueType *shimchecker.Type,
) bool {
  if checker == nil || valueType == nil {
    return false
  }
  valueType = constrainedPromiseType(checker, valueType)
  for _, part := range promiseUnionParts(valueType) {
    for _, signature := range checker.GetSignaturesOfType(part, shimchecker.SignatureKindCall) {
      returnType := constrainedPromiseType(checker, checker.GetReturnTypeOfSignature(signature))
      if isThenableAtLocation(checker, location, returnType) {
        return true
      }
    }
  }
  return false
}

func noMisusedPromisesIsVoidReturningFunctionType(
  checker *shimchecker.Checker,
  location *shimast.Node,
  valueType *shimchecker.Type,
) bool {
  if checker == nil || valueType == nil {
    return false
  }
  valueType = constrainedPromiseType(checker, valueType)
  hadVoid := false
  for _, part := range promiseUnionParts(valueType) {
    for _, signature := range checker.GetSignaturesOfType(part, shimchecker.SignatureKindCall) {
      returnType := constrainedPromiseType(checker, checker.GetReturnTypeOfSignature(signature))
      if isThenableAtLocation(checker, location, returnType) {
        return false
      }
      if returnType != nil && returnType.Flags()&shimchecker.TypeFlagsVoid != 0 {
        hadVoid = true
      }
    }
  }
  return hadVoid
}
