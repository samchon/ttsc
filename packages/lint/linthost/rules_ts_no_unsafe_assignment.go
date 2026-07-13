// typescript/no-unsafe-assignment rejects `any` values that escape through an
// assignment boundary. It follows @typescript-eslint/no-unsafe-assignment's
// assignment sites and generic comparison boundary: direct `any` is unsafe
// unless the receiver is `unknown`, while nested type arguments are compared
// only when both sides are references to the same generic target.
package linthost

import (
  "fmt"
  "strconv"
  "strings"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimchecker "github.com/microsoft/typescript-go/shim/checker"
)

type noUnsafeAssignment struct{}

type noUnsafeAssignmentComparison uint8

const (
  noUnsafeAssignmentComparisonNone noUnsafeAssignmentComparison = iota
  noUnsafeAssignmentComparisonBasic
)

func (noUnsafeAssignment) Name() string { return "typescript/no-unsafe-assignment" }
func (noUnsafeAssignment) NeedsTypeChecker() bool {
  return true
}
func (noUnsafeAssignment) Visits() []shimast.Kind {
  return []shimast.Kind{
    shimast.KindVariableDeclaration,
    shimast.KindParameter,
    shimast.KindPropertyDeclaration,
    shimast.KindBindingElement,
    shimast.KindBinaryExpression,
    shimast.KindPropertyAssignment,
    shimast.KindShorthandPropertyAssignment,
    shimast.KindSpreadElement,
    shimast.KindJsxAttribute,
  }
}

func (noUnsafeAssignment) Check(ctx *Context, node *shimast.Node) {
  if ctx.Checker == nil || node == nil {
    return
  }

  switch node.Kind {
  case shimast.KindVariableDeclaration:
    noUnsafeAssignmentCheckVariable(ctx, node)
  case shimast.KindParameter:
    noUnsafeAssignmentCheckParameter(ctx, node)
  case shimast.KindPropertyDeclaration:
    noUnsafeAssignmentCheckPropertyDeclaration(ctx, node)
  case shimast.KindBindingElement:
    noUnsafeAssignmentCheckBindingDefault(ctx, node)
  case shimast.KindBinaryExpression:
    noUnsafeAssignmentCheckBinary(ctx, node)
  case shimast.KindPropertyAssignment:
    noUnsafeAssignmentCheckObjectProperty(ctx, node)
  case shimast.KindShorthandPropertyAssignment:
    noUnsafeAssignmentCheckShorthandProperty(ctx, node)
  case shimast.KindSpreadElement:
    noUnsafeAssignmentCheckArraySpread(ctx, node)
  case shimast.KindJsxAttribute:
    noUnsafeAssignmentCheckJsxAttribute(ctx, node)
  }
}

func noUnsafeAssignmentCheckVariable(ctx *Context, node *shimast.Node) {
  decl := node.AsVariableDeclaration()
  if decl == nil || decl.Name() == nil || decl.Initializer == nil {
    return
  }
  comparison := noUnsafeAssignmentComparisonNone
  if decl.Type != nil {
    comparison = noUnsafeAssignmentComparisonBasic
  }
  noUnsafeAssignmentCheckSite(ctx, decl.Name(), decl.Initializer, node, comparison)
}

func noUnsafeAssignmentCheckParameter(ctx *Context, node *shimast.Node) {
  decl := node.AsParameterDeclaration()
  if decl == nil || decl.Name() == nil || decl.Initializer == nil {
    return
  }
  // A default initializer is an AssignmentPattern upstream. The parameter has
  // an established receiver type even when it has no written annotation.
  noUnsafeAssignmentCheckSite(
    ctx,
    decl.Name(),
    decl.Initializer,
    node,
    noUnsafeAssignmentComparisonBasic,
  )
}

func noUnsafeAssignmentCheckPropertyDeclaration(ctx *Context, node *shimast.Node) {
  decl := node.AsPropertyDeclaration()
  if decl == nil || decl.Name() == nil || decl.Initializer == nil {
    return
  }
  comparison := noUnsafeAssignmentComparisonNone
  if decl.Type != nil {
    comparison = noUnsafeAssignmentComparisonBasic
  }
  noUnsafeAssignmentCheck(
    ctx,
    decl.Name(),
    decl.Initializer,
    node,
    comparison,
    nil,
  )
}

func noUnsafeAssignmentCheckBindingDefault(ctx *Context, node *shimast.Node) {
  binding := node.AsBindingElement()
  if binding == nil || binding.Name() == nil || binding.Initializer == nil {
    return
  }
  noUnsafeAssignmentCheckSite(
    ctx,
    binding.Name(),
    binding.Initializer,
    node,
    noUnsafeAssignmentComparisonBasic,
  )
}

func noUnsafeAssignmentCheckBinary(ctx *Context, node *shimast.Node) {
  expression := node.AsBinaryExpression()
  if expression == nil || expression.OperatorToken == nil ||
    expression.OperatorToken.Kind != shimast.KindEqualsToken ||
    expression.Left == nil || expression.Right == nil {
    return
  }
  noUnsafeAssignmentCheckSite(
    ctx,
    expression.Left,
    expression.Right,
    node,
    noUnsafeAssignmentComparisonBasic,
  )
}

func noUnsafeAssignmentCheckObjectProperty(ctx *Context, node *shimast.Node) {
  property := node.AsPropertyAssignment()
  if property == nil || property.Name() == nil || property.Initializer == nil ||
    node.Parent == nil || node.Parent.Kind != shimast.KindObjectLiteralExpression ||
    noUnsafeAssignmentIsAssignmentTarget(node) {
    return
  }
  receiverType := ctx.Checker.GetContextualTypeForObjectLiteralElement(node, 0)
  noUnsafeAssignmentCheck(
    ctx,
    property.Name(),
    property.Initializer,
    node,
    noUnsafeAssignmentComparisonBasic,
    receiverType,
  )
}

func noUnsafeAssignmentCheckShorthandProperty(ctx *Context, node *shimast.Node) {
  property := node.AsShorthandPropertyAssignment()
  if property == nil || property.Name() == nil {
    return
  }

  // `{ value = fallback }` in a destructuring assignment is represented by a
  // shorthand property with an object-assignment initializer in the tsgo AST.
  if property.ObjectAssignmentInitializer != nil {
    noUnsafeAssignmentCheckSite(
      ctx,
      property.Name(),
      property.ObjectAssignmentInitializer,
      node,
      noUnsafeAssignmentComparisonBasic,
    )
    return
  }

  if node.Parent == nil || node.Parent.Kind != shimast.KindObjectLiteralExpression ||
    noUnsafeAssignmentIsAssignmentTarget(node) {
    return
  }
  receiverType := ctx.Checker.GetContextualTypeForObjectLiteralElement(node, 0)
  noUnsafeAssignmentCheck(
    ctx,
    property.Name(),
    property.Name(),
    node,
    noUnsafeAssignmentComparisonBasic,
    receiverType,
  )
}

func noUnsafeAssignmentCheckArraySpread(ctx *Context, node *shimast.Node) {
  spread := node.AsSpreadElement()
  if spread == nil || spread.Expression == nil || node.Parent == nil ||
    node.Parent.Kind != shimast.KindArrayLiteralExpression ||
    noUnsafeAssignmentIsAssignmentTarget(node) {
    return
  }
  senderType := ctx.Checker.GetTypeAtLocation(spread.Expression)
  if typeIsUnsafeAny(senderType) || noUnsafeAssignmentIsAnyArray(ctx.Checker, senderType) {
    ctx.Report(node, "Unsafe spread of an `any` value in an array.")
  }
}

func noUnsafeAssignmentCheckJsxAttribute(ctx *Context, node *shimast.Node) {
  attribute := node.AsJsxAttribute()
  if attribute == nil || attribute.Initializer == nil ||
    attribute.Initializer.Kind != shimast.KindJsxExpression {
    return
  }
  container := attribute.Initializer.AsJsxExpression()
  if container == nil || container.Expression == nil {
    return
  }
  receiverType := ctx.Checker.GetContextualTypeForJsxAttribute(node)
  noUnsafeAssignmentCheck(
    ctx,
    attribute.Name(),
    container.Expression,
    container.Expression,
    noUnsafeAssignmentComparisonBasic,
    receiverType,
  )
}

// noUnsafeAssignmentCheckSite checks the main assignment and then, only when
// that boundary did not report, checks unsafe leaves exposed by destructuring.
func noUnsafeAssignmentCheckSite(
  ctx *Context,
  receiverNode *shimast.Node,
  senderNode *shimast.Node,
  reportingNode *shimast.Node,
  comparison noUnsafeAssignmentComparison,
) {
  if noUnsafeAssignmentCheck(
    ctx,
    receiverNode,
    senderNode,
    reportingNode,
    comparison,
    nil,
  ) {
    return
  }
  senderType := ctx.Checker.GetTypeAtLocation(stripParens(senderNode))
  if noUnsafeAssignmentCheckArrayDestructure(ctx, stripParens(receiverNode), senderType, senderNode) {
    return
  }
  noUnsafeAssignmentCheckObjectDestructure(ctx, stripParens(receiverNode), senderType, senderNode)
}

// noUnsafeAssignmentCheck returns true when it reports this assignment.
func noUnsafeAssignmentCheck(
  ctx *Context,
  receiverNode *shimast.Node,
  senderNode *shimast.Node,
  reportingNode *shimast.Node,
  comparison noUnsafeAssignmentComparison,
  contextualReceiver *shimchecker.Type,
) bool {
  senderNode = stripParens(senderNode)
  if receiverNode == nil || senderNode == nil {
    return false
  }

  receiverType := contextualReceiver
  if receiverType == nil {
    receiverType = ctx.Checker.GetTypeAtLocation(stripParens(receiverNode))
  }
  senderType := ctx.Checker.GetTypeAtLocation(senderNode)
  if receiverType == nil || senderType == nil {
    return false
  }

  if typeIsUnsafeAny(senderType) {
    if noUnsafeAssignmentIsUnknown(receiverType) {
      return false
    }
    ctx.Report(reportingNode, "Unsafe assignment of an `any` value.")
    return true
  }

  if comparison == noUnsafeAssignmentComparisonNone {
    return false
  }

  result := noUnsafeAssignmentCompareTypes(
    ctx.Checker,
    senderType,
    receiverType,
    senderNode,
    make(map[*shimchecker.Type]map[*shimchecker.Type]struct{}),
  )
  if result == nil {
    return false
  }
  ctx.Report(
    reportingNode,
    fmt.Sprintf(
      "Unsafe assignment of type `%s` to a variable of type `%s`.",
      ctx.Checker.TypeToString(result.sender),
      ctx.Checker.TypeToString(result.receiver),
    ),
  )
  return true
}

type noUnsafeAssignmentTypePair struct {
  sender   *shimchecker.Type
  receiver *shimchecker.Type
}

func noUnsafeAssignmentCompareTypes(
  checker *shimchecker.Checker,
  sender *shimchecker.Type,
  receiver *shimchecker.Type,
  senderNode *shimast.Node,
  visited map[*shimchecker.Type]map[*shimchecker.Type]struct{},
) *noUnsafeAssignmentTypePair {
  if sender == nil || receiver == nil {
    return nil
  }
  if typeIsUnsafeAny(sender) {
    if noUnsafeAssignmentIsUnknown(receiver) || typeIsUnsafeAny(receiver) {
      return nil
    }
    return &noUnsafeAssignmentTypePair{sender: sender, receiver: receiver}
  }

  receivers := visited[sender]
  if receivers == nil {
    receivers = make(map[*shimchecker.Type]struct{})
    visited[sender] = receivers
  } else if _, ok := receivers[receiver]; ok {
    return nil
  }
  receivers[receiver] = struct{}{}

  if !noUnsafeAssignmentIsTypeReference(sender) ||
    !noUnsafeAssignmentIsTypeReference(receiver) ||
    sender.Target() != receiver.Target() {
    return nil
  }
  if noUnsafeAssignmentIsEmptyMapConstructor(senderNode) {
    return nil
  }

  senderArguments := checker.GetTypeArguments(sender)
  receiverArguments := checker.GetTypeArguments(receiver)
  for index, senderArgument := range senderArguments {
    if index >= len(receiverArguments) {
      return nil
    }
    if noUnsafeAssignmentCompareTypes(
      checker,
      senderArgument,
      receiverArguments[index],
      senderNode,
      visited,
    ) != nil {
      return &noUnsafeAssignmentTypePair{sender: sender, receiver: receiver}
    }
  }
  return nil
}

func noUnsafeAssignmentIsTypeReference(value *shimchecker.Type) bool {
  return value != nil &&
    value.Flags()&shimchecker.TypeFlagsObject != 0 &&
    value.ObjectFlags()&shimchecker.ObjectFlagsReference != 0
}

func noUnsafeAssignmentIsUnknown(value *shimchecker.Type) bool {
  return value != nil && value.Flags()&shimchecker.TypeFlagsUnknown != 0
}

func noUnsafeAssignmentIsEmptyMapConstructor(node *shimast.Node) bool {
  node = stripParens(node)
  if node == nil || node.Kind != shimast.KindNewExpression {
    return false
  }
  expression := node.AsNewExpression()
  if expression == nil || identifierText(expression.Expression) != "Map" ||
    expression.TypeArguments != nil {
    return false
  }
  return expression.Arguments == nil || len(expression.Arguments.Nodes) == 0
}

func noUnsafeAssignmentIsAnyArray(checker *shimchecker.Checker, value *shimchecker.Type) bool {
  if checker == nil || value == nil {
    return false
  }
  return typeIsUnsafeAny(checker.GetElementTypeOfArrayType(value))
}

func noUnsafeAssignmentCheckArrayDestructure(
  ctx *Context,
  receiver *shimast.Node,
  senderType *shimchecker.Type,
  senderNode *shimast.Node,
) bool {
  if receiver == nil || senderType == nil ||
    (receiver.Kind != shimast.KindArrayBindingPattern &&
      receiver.Kind != shimast.KindArrayLiteralExpression) {
    return false
  }
  if noUnsafeAssignmentIsAnyArray(ctx.Checker, senderType) {
    ctx.Report(receiver, "Unsafe array destructuring of an `any` array value.")
    return true
  }
  if !shimchecker.IsTupleType(senderType) {
    return false
  }

  senderElements := ctx.Checker.GetTypeArguments(senderType)
  receiverElements := noUnsafeAssignmentArrayPatternElements(receiver)
  didReport := false
  for index, element := range receiverElements {
    if element == nil || index >= len(senderElements) {
      continue
    }
    target, reportingNode, canRecurse := noUnsafeAssignmentArrayPatternTarget(element)
    if target == nil {
      continue
    }
    elementType := senderElements[index]
    if typeIsUnsafeAny(elementType) {
      ctx.Report(reportingNode, "Unsafe array destructuring of a tuple element with an `any` value.")
      didReport = true
      continue
    }
    if !canRecurse {
      continue
    }
    if noUnsafeAssignmentCheckArrayDestructure(ctx, target, elementType, senderNode) ||
      noUnsafeAssignmentCheckObjectDestructure(ctx, target, elementType, senderNode) {
      didReport = true
    }
  }
  return didReport
}

func noUnsafeAssignmentArrayPatternElements(receiver *shimast.Node) []*shimast.Node {
  switch receiver.Kind {
  case shimast.KindArrayBindingPattern:
    pattern := receiver.AsBindingPattern()
    if pattern != nil && pattern.Elements != nil {
      return pattern.Elements.Nodes
    }
  case shimast.KindArrayLiteralExpression:
    pattern := receiver.AsArrayLiteralExpression()
    if pattern != nil && pattern.Elements != nil {
      return pattern.Elements.Nodes
    }
  }
  return nil
}

func noUnsafeAssignmentArrayPatternTarget(element *shimast.Node) (
  target *shimast.Node,
  reportingNode *shimast.Node,
  canRecurse bool,
) {
  switch element.Kind {
  case shimast.KindOmittedExpression, shimast.KindSpreadElement:
    return nil, nil, false
  case shimast.KindBindingElement:
    binding := element.AsBindingElement()
    if binding == nil || binding.DotDotDotToken != nil || binding.Name() == nil {
      return nil, nil, false
    }
    if binding.Initializer != nil {
      return binding.Name(), element, false
    }
    return binding.Name(), binding.Name(), true
  case shimast.KindBinaryExpression:
    expression := element.AsBinaryExpression()
    if expression == nil || expression.OperatorToken == nil ||
      expression.OperatorToken.Kind != shimast.KindEqualsToken {
      return element, element, true
    }
    return expression.Left, element, false
  default:
    return element, element, true
  }
}

func noUnsafeAssignmentCheckObjectDestructure(
  ctx *Context,
  receiver *shimast.Node,
  senderType *shimchecker.Type,
  senderNode *shimast.Node,
) bool {
  if receiver == nil || senderType == nil ||
    (receiver.Kind != shimast.KindObjectBindingPattern &&
      receiver.Kind != shimast.KindObjectLiteralExpression) {
    return false
  }

  properties := make(map[string]*shimchecker.Type)
  for _, symbol := range shimchecker.Checker_getPropertiesOfType(ctx.Checker, senderType) {
    if symbol == nil {
      continue
    }
    properties[symbol.Name] = shimchecker.Checker_getTypeOfSymbolAtLocation(
      ctx.Checker,
      symbol,
      senderNode,
    )
  }

  didReport := false
  for _, property := range noUnsafeAssignmentObjectPatternProperties(receiver) {
    keyNode, target, reportingNode, canRecurse := noUnsafeAssignmentObjectPatternTarget(property)
    key, ok := noUnsafeAssignmentPropertyName(keyNode)
    if !ok || target == nil {
      continue
    }
    propertyType := properties[key]
    if propertyType == nil {
      continue
    }
    if typeIsUnsafeAny(propertyType) {
      ctx.Report(reportingNode, "Unsafe object destructuring of a property with an `any` value.")
      didReport = true
      continue
    }
    if !canRecurse {
      continue
    }
    if noUnsafeAssignmentCheckArrayDestructure(ctx, target, propertyType, senderNode) ||
      noUnsafeAssignmentCheckObjectDestructure(ctx, target, propertyType, senderNode) {
      didReport = true
    }
  }
  return didReport
}

func noUnsafeAssignmentObjectPatternProperties(receiver *shimast.Node) []*shimast.Node {
  switch receiver.Kind {
  case shimast.KindObjectBindingPattern:
    pattern := receiver.AsBindingPattern()
    if pattern != nil && pattern.Elements != nil {
      return pattern.Elements.Nodes
    }
  case shimast.KindObjectLiteralExpression:
    pattern := receiver.AsObjectLiteralExpression()
    if pattern != nil && pattern.Properties != nil {
      return pattern.Properties.Nodes
    }
  }
  return nil
}

func noUnsafeAssignmentObjectPatternTarget(property *shimast.Node) (
  key *shimast.Node,
  target *shimast.Node,
  reportingNode *shimast.Node,
  canRecurse bool,
) {
  if property == nil {
    return nil, nil, nil, false
  }
  switch property.Kind {
  case shimast.KindBindingElement:
    binding := property.AsBindingElement()
    if binding == nil || binding.DotDotDotToken != nil || binding.Name() == nil {
      return nil, nil, nil, false
    }
    key = binding.PropertyName
    if key == nil {
      key = binding.Name()
    }
    if binding.Initializer != nil {
      return key, binding.Name(), property, false
    }
    return key, binding.Name(), binding.Name(), true
  case shimast.KindPropertyAssignment:
    assignment := property.AsPropertyAssignment()
    if assignment == nil || assignment.Name() == nil || assignment.Initializer == nil {
      return nil, nil, nil, false
    }
    canRecurse = assignment.Initializer.Kind != shimast.KindBinaryExpression
    return assignment.Name(), assignment.Initializer, assignment.Initializer, canRecurse
  case shimast.KindShorthandPropertyAssignment:
    assignment := property.AsShorthandPropertyAssignment()
    if assignment == nil || assignment.Name() == nil {
      return nil, nil, nil, false
    }
    if assignment.ObjectAssignmentInitializer != nil {
      return assignment.Name(), assignment.Name(), property, false
    }
    return assignment.Name(), assignment.Name(), assignment.Name(), true
  }
  return nil, nil, nil, false
}

func noUnsafeAssignmentPropertyName(node *shimast.Node) (string, bool) {
  node = stripParens(node)
  if node == nil {
    return "", false
  }
  switch node.Kind {
  case shimast.KindIdentifier:
    return identifierText(node), true
  case shimast.KindStringLiteral, shimast.KindNoSubstitutionTemplateLiteral:
    return stringLiteralText(node), true
  case shimast.KindNumericLiteral, shimast.KindBigIntLiteral:
    return noUnsafeAssignmentNormalizeNumericKey(numericLiteralText(node)), true
  case shimast.KindTrueKeyword:
    return "true", true
  case shimast.KindFalseKeyword:
    return "false", true
  case shimast.KindNullKeyword:
    return "null", true
  case shimast.KindComputedPropertyName:
    computed := node.AsComputedPropertyName()
    if computed != nil {
      return noUnsafeAssignmentPropertyName(computed.Expression)
    }
  }
  return "", false
}

func noUnsafeAssignmentNormalizeNumericKey(value string) string {
  value = strings.ReplaceAll(strings.TrimSuffix(value, "n"), "_", "")
  if integer, err := strconv.ParseInt(value, 0, 64); err == nil {
    return strconv.FormatInt(integer, 10)
  }
  if integer, err := strconv.ParseUint(value, 0, 64); err == nil {
    return strconv.FormatUint(integer, 10)
  }
  if number, err := strconv.ParseFloat(value, 64); err == nil {
    return strconv.FormatFloat(number, 'g', -1, 64)
  }
  return value
}

// noUnsafeAssignmentIsAssignmentTarget distinguishes object/array literals on
// the left of `=` from source literals. tsgo represents destructuring
// assignment targets as literal-expression nodes, unlike binding declarations.
func noUnsafeAssignmentIsAssignmentTarget(node *shimast.Node) bool {
  child := node
  for child != nil && child.Parent != nil {
    parent := child.Parent
    switch parent.Kind {
    case shimast.KindBindingElement:
      binding := parent.AsBindingElement()
      if binding != nil &&
        (binding.PropertyName == child || binding.Initializer == child) {
        return false
      }
    case shimast.KindPropertyAssignment:
      property := parent.AsPropertyAssignment()
      if property != nil && property.Name() == child {
        return false
      }
    case shimast.KindShorthandPropertyAssignment:
      property := parent.AsShorthandPropertyAssignment()
      if property != nil && property.ObjectAssignmentInitializer == child {
        return false
      }
    case shimast.KindComputedPropertyName:
      return false
    }
    if parent.Kind == shimast.KindBinaryExpression {
      expression := parent.AsBinaryExpression()
      if expression != nil && expression.OperatorToken != nil &&
        expression.OperatorToken.Kind == shimast.KindEqualsToken {
        if expression.Left == child {
          return true
        }
        if expression.Right == child {
          return false
        }
      }
    }
    child = parent
  }
  return false
}

func init() {
  Register(noUnsafeAssignment{})
}
