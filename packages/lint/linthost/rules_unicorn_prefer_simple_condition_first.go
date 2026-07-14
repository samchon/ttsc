// unicorn/prefer-simple-condition-first keeps cheap, side-effect-free gates
// ahead of complex conditions in boolean && and || chains. The rule mirrors
// Unicorn's structural definition of "simple": identifiers, their negations,
// and strict comparisons built from identifiers/typeof identifiers and
// literals. It never ranks arbitrary expressions with a project-specific
// complexity score.
//
// A stable partition is offered only when every complex operand that crosses
// a simple operand is itself safe to move. Comments and TypeScript wrappers
// around logical subexpressions suppress the edit even when the diagnostic is
// safe, preserving evaluation order, source ownership, and syntax exactly.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-simple-condition-first.md
package linthost

import (
  "strings"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimscanner "github.com/microsoft/typescript-go/shim/scanner"
)

const (
  unicornPreferSimpleConditionFirstSafeMessagePrefix = "Prefer this simple condition first in the `"
  unicornPreferSimpleConditionFirstUnsafeMessage     = "Consider moving this simple condition first after verifying short-circuit behavior."
)

type unicornPreferSimpleConditionFirst struct{}

type unicornPreferSimpleConditionFirstOperand struct {
  node   *shimast.Node
  simple bool
}

type unicornPreferSimpleConditionFirstCommentSpan struct {
  start int
  end   int
}

func (unicornPreferSimpleConditionFirst) Name() string {
  return "unicorn/prefer-simple-condition-first"
}

func (unicornPreferSimpleConditionFirst) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindSourceFile}
}

// The checker is used only to distinguish the global Boolean conversion
// function from a same-named local binding. All other classification is AST
// structural.
func (unicornPreferSimpleConditionFirst) NeedsTypeChecker() bool { return true }

func (unicornPreferSimpleConditionFirst) Check(ctx *Context, root *shimast.Node) {
  if ctx == nil || ctx.File == nil || root == nil {
    return
  }
  comments := make([]unicornPreferSimpleConditionFirstCommentSpan, 0)
  forEachCommentToken(ctx.File, func(_ shimast.Kind, start, end int) {
    comments = append(comments, unicornPreferSimpleConditionFirstCommentSpan{start: start, end: end})
  })
  walkDescendants(root, func(node *shimast.Node) {
    if node.Kind == shimast.KindBinaryExpression {
      unicornPreferSimpleConditionFirstCheckLogical(ctx, node, comments)
    }
  })
}

func unicornPreferSimpleConditionFirstCheckLogical(
  ctx *Context,
  node *shimast.Node,
  comments []unicornPreferSimpleConditionFirstCommentSpan,
) {
  binary := node.AsBinaryExpression()
  if binary == nil || binary.OperatorToken == nil ||
    !unicornPreferSimpleConditionFirstIsLogicalOperator(binary.OperatorToken.Kind) {
    return
  }
  operator := binary.OperatorToken.Kind
  if unicornPreferSimpleConditionFirstHasSameOperatorParent(node, operator) ||
    !unicornPreferSimpleConditionFirstIsBooleanContext(ctx, node) {
    return
  }

  nodes := unicornPreferSimpleConditionFirstLogicalOperands(node, operator, nil)
  operands := make([]unicornPreferSimpleConditionFirstOperand, len(nodes))
  firstComplex := -1
  firstMisplacedSimple := -1
  lastSimple := -1
  for index, operand := range nodes {
    simple := unicornPreferSimpleConditionFirstIsSimple(operand)
    operands[index] = unicornPreferSimpleConditionFirstOperand{node: operand, simple: simple}
    if simple {
      lastSimple = index
      if firstComplex >= 0 && firstMisplacedSimple < 0 {
        firstMisplacedSimple = index
      }
    } else if firstComplex < 0 {
      firstComplex = index
    }
  }
  if firstComplex < 0 || firstMisplacedSimple < 0 {
    return
  }

  canSafelyReorder := true
  for index, operand := range operands {
    if !operand.simple && index <= lastSimple &&
      !unicornPreferSimpleConditionFirstIsSafeToMove(operand.node) {
      canSafelyReorder = false
      break
    }
  }

  message := unicornPreferSimpleConditionFirstUnsafeMessage
  if canSafelyReorder {
    message = unicornPreferSimpleConditionFirstSafeMessagePrefix +
      unicornPreferSimpleConditionFirstOperatorText(operator) + "` expression."
  }

  reportNode := unicornPreferSimpleConditionFirstReportNode(nodes[firstMisplacedSimple])
  if !canSafelyReorder ||
    unicornPreferSimpleConditionFirstHasTypeScriptWrappedLogical(node, operator) ||
    unicornPreferSimpleConditionFirstCommentsPreventFix(ctx, node, nodes, comments) {
    ctx.Report(reportNode, message)
    return
  }

  start, end := tokenRange(ctx.File, node)
  if start < 0 || end <= start {
    ctx.Report(reportNode, message)
    return
  }
  reordered := make([]*shimast.Node, 0, len(operands))
  for _, operand := range operands {
    if operand.simple {
      reordered = append(reordered, operand.node)
    }
  }
  for _, operand := range operands {
    if !operand.simple {
      reordered = append(reordered, operand.node)
    }
  }
  parts := make([]string, len(reordered))
  for index, operand := range reordered {
    text, ok := unicornPreferSimpleConditionFirstOperandText(ctx, operand, operator, index == 0)
    if !ok {
      ctx.Report(reportNode, message)
      return
    }
    parts[index] = text
  }
  ctx.ReportFix(
    reportNode,
    message,
    TextEdit{
      Pos:  start,
      End:  end,
      Text: strings.Join(parts, " "+unicornPreferSimpleConditionFirstOperatorText(operator)+" "),
    },
  )
}

func unicornPreferSimpleConditionFirstIsLogicalOperator(kind shimast.Kind) bool {
  return kind == shimast.KindAmpersandAmpersandToken || kind == shimast.KindBarBarToken
}

func unicornPreferSimpleConditionFirstOperatorText(kind shimast.Kind) string {
  if kind == shimast.KindAmpersandAmpersandToken {
    return "&&"
  }
  return "||"
}

// Logical operands are flattened through parentheses and TypeScript's
// expression-only wrappers because ESTree exposes the same chain without
// those TypeScript AST nodes. The original operand is retained whenever the
// unwrapped value is not another matching logical expression so fixes preserve
// its exact wrapper text.
func unicornPreferSimpleConditionFirstLogicalOperands(
  node *shimast.Node,
  operator shimast.Kind,
  operands []*shimast.Node,
) []*shimast.Node {
  unwrapped := unicornPreferSimpleConditionFirstUnwrap(node)
  if unwrapped == nil || unwrapped.Kind != shimast.KindBinaryExpression {
    return append(operands, node)
  }
  binary := unwrapped.AsBinaryExpression()
  if binary == nil || binary.OperatorToken == nil || binary.OperatorToken.Kind != operator {
    return append(operands, node)
  }
  operands = unicornPreferSimpleConditionFirstLogicalOperands(binary.Left, operator, operands)
  return unicornPreferSimpleConditionFirstLogicalOperands(binary.Right, operator, operands)
}

func unicornPreferSimpleConditionFirstIsIdentifierOrTypeofIdentifier(node *shimast.Node) bool {
  node = unicornPreferSimpleConditionFirstUnwrap(node)
  if node == nil {
    return false
  }
  if node.Kind == shimast.KindIdentifier {
    return true
  }
  if node.Kind != shimast.KindTypeOfExpression {
    return false
  }
  expression := unicornPreferSimpleConditionFirstUnwrap(node.Expression())
  return expression != nil && expression.Kind == shimast.KindIdentifier
}

func unicornPreferSimpleConditionFirstIsLiteral(node *shimast.Node) bool {
  node = unicornPreferSimpleConditionFirstUnwrap(node)
  if node == nil {
    return false
  }
  switch node.Kind {
  case shimast.KindStringLiteral,
    shimast.KindNumericLiteral,
    shimast.KindBigIntLiteral,
    shimast.KindRegularExpressionLiteral,
    shimast.KindTrueKeyword,
    shimast.KindFalseKeyword,
    shimast.KindNullKeyword:
    return true
  }
  return false
}

func unicornPreferSimpleConditionFirstIsSimpleOperand(node *shimast.Node) bool {
  node = unicornPreferSimpleConditionFirstUnwrap(node)
  if node == nil {
    return false
  }
  if unicornPreferSimpleConditionFirstIsIdentifierOrTypeofIdentifier(node) ||
    unicornPreferSimpleConditionFirstIsLiteral(node) {
    return true
  }
  if node.Kind != shimast.KindPrefixUnaryExpression {
    return false
  }
  prefix := node.AsPrefixUnaryExpression()
  if prefix == nil || (prefix.Operator != shimast.KindMinusToken && prefix.Operator != shimast.KindPlusToken) {
    return false
  }
  argument := unicornPreferSimpleConditionFirstUnwrap(prefix.Operand)
  if argument == nil {
    return false
  }
  return argument.Kind == shimast.KindNumericLiteral ||
    (prefix.Operator == shimast.KindMinusToken && argument.Kind == shimast.KindBigIntLiteral)
}

func unicornPreferSimpleConditionFirstIsSimple(node *shimast.Node) bool {
  node = unicornPreferSimpleConditionFirstUnwrap(node)
  if node == nil {
    return false
  }
  if node.Kind == shimast.KindIdentifier {
    return true
  }
  if node.Kind == shimast.KindPrefixUnaryExpression {
    prefix := node.AsPrefixUnaryExpression()
    return prefix != nil && prefix.Operator == shimast.KindExclamationToken &&
      unicornPreferSimpleConditionFirstIsSimple(prefix.Operand)
  }
  if node.Kind != shimast.KindBinaryExpression {
    return false
  }
  binary := node.AsBinaryExpression()
  if binary == nil || binary.OperatorToken == nil ||
    (binary.OperatorToken.Kind != shimast.KindEqualsEqualsEqualsToken &&
      binary.OperatorToken.Kind != shimast.KindExclamationEqualsEqualsToken) {
    return false
  }
  left := unicornPreferSimpleConditionFirstUnwrap(binary.Left)
  right := unicornPreferSimpleConditionFirstUnwrap(binary.Right)
  return unicornPreferSimpleConditionFirstIsSimpleOperand(left) &&
    unicornPreferSimpleConditionFirstIsSimpleOperand(right) &&
    (unicornPreferSimpleConditionFirstIsIdentifierOrTypeofIdentifier(left) ||
      unicornPreferSimpleConditionFirstIsIdentifierOrTypeofIdentifier(right))
}

func unicornPreferSimpleConditionFirstIsSafeConditional(node *shimast.Node) bool {
  node = unicornPreferSimpleConditionFirstUnwrap(node)
  if node == nil || node.Kind != shimast.KindConditionalExpression {
    return false
  }
  conditional := node.AsConditionalExpression()
  if conditional == nil {
    return false
  }
  for _, child := range []*shimast.Node{conditional.Condition, conditional.WhenTrue, conditional.WhenFalse} {
    if !unicornPreferSimpleConditionFirstIsSimple(child) &&
      !unicornPreferSimpleConditionFirstIsSimpleOperand(child) &&
      !unicornPreferSimpleConditionFirstIsSafeConditional(child) {
      return false
    }
  }
  return true
}

func unicornPreferSimpleConditionFirstIsSafeToMove(node *shimast.Node) bool {
  return unicornPreferSimpleConditionFirstIsSimple(node) ||
    unicornPreferSimpleConditionFirstIsSafeConditional(node)
}

func unicornPreferSimpleConditionFirstIsBooleanContext(ctx *Context, node *shimast.Node) bool {
  current := node
  for current != nil && current.Parent != nil {
    parent := current.Parent
    if child, ok := unicornPreferSimpleConditionFirstTransparentChild(parent); ok && child == current {
      current = parent
      continue
    }
    if parent.Kind == shimast.KindBinaryExpression {
      binary := parent.AsBinaryExpression()
      if binary != nil && binary.OperatorToken != nil &&
        unicornPreferSimpleConditionFirstIsLogicalOperator(binary.OperatorToken.Kind) &&
        (binary.Left == current || binary.Right == current) {
        current = parent
        continue
      }
    }
    switch parent.Kind {
    case shimast.KindIfStatement:
      return parent.AsIfStatement().Expression == current
    case shimast.KindWhileStatement:
      return parent.AsWhileStatement().Expression == current
    case shimast.KindDoStatement:
      return parent.AsDoStatement().Expression == current
    case shimast.KindForStatement:
      return parent.AsForStatement().Condition == current
    case shimast.KindConditionalExpression:
      return parent.AsConditionalExpression().Condition == current
    case shimast.KindPrefixUnaryExpression:
      prefix := parent.AsPrefixUnaryExpression()
      return prefix != nil && prefix.Operator == shimast.KindExclamationToken && prefix.Operand == current
    case shimast.KindCallExpression:
      call := parent.AsCallExpression()
      return unicornPreferSimpleConditionFirstIsGlobalBooleanCall(ctx, call, current)
    }
    return false
  }
  return false
}

func unicornPreferSimpleConditionFirstIsGlobalBooleanCall(
  ctx *Context,
  call *shimast.CallExpression,
  argument *shimast.Node,
) bool {
  if ctx == nil || ctx.Checker == nil || ctx.File == nil || call == nil ||
    call.QuestionDotToken != nil || call.Arguments == nil || len(call.Arguments.Nodes) != 1 ||
    call.Arguments.Nodes[0] != argument || argument.Kind == shimast.KindSpreadElement {
    return false
  }
  // ESTree erases grouping parentheses around a callee, but retains
  // TypeScript assertion wrappers. Only the former may be transparent here:
  // `(Boolean)(value)` is the global conversion, while
  // `(Boolean as Converter)(value)` is not the canonical call shape.
  callee := stripParens(call.Expression)
  if identifierText(callee) != "Boolean" {
    return false
  }
  resolved := ctx.Checker.GetSymbolAtLocation(callee)
  global := ctx.Checker.GetGlobalSymbol("Boolean", shimast.SymbolFlagsValue, nil)
  if resolved == nil || global == nil {
    return false
  }
  resolved = ctx.Checker.GetMergedSymbol(resolved)
  global = ctx.Checker.GetMergedSymbol(global)
  if resolved != global {
    return false
  }
  for _, declaration := range resolved.Declarations {
    if declaration != nil && shimast.GetSourceFileOfNode(declaration) == ctx.File &&
      unicornPreferSimpleConditionFirstDeclarationIntroducesValue(declaration) {
      return false
    }
  }
  return true
}

func unicornPreferSimpleConditionFirstDeclarationIntroducesValue(declaration *shimast.Node) bool {
  switch declaration.Kind {
  case shimast.KindVariableDeclaration,
    shimast.KindBindingElement,
    shimast.KindFunctionDeclaration,
    shimast.KindClassDeclaration,
    shimast.KindEnumDeclaration,
    shimast.KindModuleDeclaration,
    shimast.KindImportEqualsDeclaration:
    return true
  }
  return false
}

func unicornPreferSimpleConditionFirstHasSameOperatorParent(node *shimast.Node, operator shimast.Kind) bool {
  current := node
  parent := current.Parent
  for parent != nil {
    child, transparent := unicornPreferSimpleConditionFirstTransparentChild(parent)
    if !transparent || child != current {
      break
    }
    current = parent
    parent = current.Parent
  }
  if parent == nil || parent.Kind != shimast.KindBinaryExpression {
    return false
  }
  binary := parent.AsBinaryExpression()
  return binary != nil && binary.OperatorToken != nil && binary.OperatorToken.Kind == operator
}

func unicornPreferSimpleConditionFirstHasTypeScriptWrappedLogical(node *shimast.Node, operator shimast.Kind) bool {
  node = stripParens(node)
  if node == nil {
    return false
  }
  if unicornPreferSimpleConditionFirstIsTypeScriptWrapper(node) {
    unwrapped := unicornPreferSimpleConditionFirstUnwrap(node)
    if unwrapped != nil && unwrapped.Kind == shimast.KindBinaryExpression {
      binary := unwrapped.AsBinaryExpression()
      return binary != nil && binary.OperatorToken != nil && binary.OperatorToken.Kind == operator
    }
    return false
  }
  if node.Kind != shimast.KindBinaryExpression {
    return false
  }
  binary := node.AsBinaryExpression()
  return binary != nil && binary.OperatorToken != nil && binary.OperatorToken.Kind == operator &&
    (unicornPreferSimpleConditionFirstHasTypeScriptWrappedLogical(binary.Left, operator) ||
      unicornPreferSimpleConditionFirstHasTypeScriptWrappedLogical(binary.Right, operator))
}

func unicornPreferSimpleConditionFirstCommentsPreventFix(
  ctx *Context,
  node *shimast.Node,
  operands []*shimast.Node,
  comments []unicornPreferSimpleConditionFirstCommentSpan,
) bool {
  if ctx == nil || ctx.File == nil || len(operands) == 0 {
    return true
  }
  source := ctx.File.Text()
  rootStart, rootEnd := tokenRange(ctx.File, node)
  firstStart, _ := tokenRange(ctx.File, operands[0])
  _, lastEnd := tokenRange(ctx.File, operands[len(operands)-1])
  if rootStart < 0 || rootEnd < rootStart || firstStart < 0 || lastEnd < 0 || lastEnd > len(source) {
    return true
  }
  leadingStart := operands[0].Pos()
  if leadingStart < 0 || leadingStart > firstStart {
    leadingStart = firstStart
  }
  trailingEnd := shimscanner.SkipTrivia(source, lastEnd)
  if trailingEnd < lastEnd || trailingEnd > len(source) {
    trailingEnd = lastEnd
  }
  ranges := [][2]int{
    {rootStart, rootEnd},
    {leadingStart, firstStart},
    {lastEnd, trailingEnd},
  }
  for _, span := range ranges {
    if unicornPreferSimpleConditionFirstCommentsOverlap(comments, span[0], span[1]) {
      return true
    }
  }
  return false
}

// forEachCommentToken returns non-overlapping spans in source order. Find the
// first comment whose end lies after start, then only that span can be the
// earliest overlap. This keeps a comment-heavy file from multiplying every
// reportable chain by the file's complete comment count.
func unicornPreferSimpleConditionFirstCommentsOverlap(
  comments []unicornPreferSimpleConditionFirstCommentSpan,
  start int,
  end int,
) bool {
  low := 0
  high := len(comments)
  for low < high {
    middle := low + (high-low)/2
    if comments[middle].end <= start {
      low = middle + 1
    } else {
      high = middle
    }
  }
  return low < len(comments) && comments[low].start < end
}

func unicornPreferSimpleConditionFirstOperandText(
  ctx *Context,
  node *shimast.Node,
  operator shimast.Kind,
  first bool,
) (string, bool) {
  start, end := tokenRange(ctx.File, node)
  if start < 0 || end <= start {
    return "", false
  }
  text := ctx.File.Text()[start:end]
  if node.Kind != shimast.KindParenthesizedExpression &&
    unicornPreferSimpleConditionFirstNeedsParentheses(node, operator, first) {
    text = "(" + text + ")"
  }
  return text, true
}

func unicornPreferSimpleConditionFirstNeedsParentheses(node *shimast.Node, operator shimast.Kind, first bool) bool {
  // first is intentionally part of the contract: upstream's utility accepts
  // the child property even though both current branches share the same
  // precedence decision.
  _ = first
  if node == nil {
    return false
  }
  if node.Kind == shimast.KindBinaryExpression {
    binary := node.AsBinaryExpression()
    if binary != nil && binary.OperatorToken != nil && binary.OperatorToken.Kind == operator {
      return false
    }
    return true
  }
  switch node.Kind {
  case shimast.KindAwaitExpression,
    shimast.KindConditionalExpression,
    shimast.KindArrowFunction,
    shimast.KindYieldExpression:
    return true
  }
  return false
}

func unicornPreferSimpleConditionFirstReportNode(node *shimast.Node) *shimast.Node {
  for node != nil && node.Kind == shimast.KindParenthesizedExpression {
    parenthesized := node.AsParenthesizedExpression()
    if parenthesized == nil || parenthesized.Expression == nil {
      break
    }
    node = parenthesized.Expression
  }
  return node
}

func unicornPreferSimpleConditionFirstUnwrap(node *shimast.Node) *shimast.Node {
  for node != nil {
    child, ok := unicornPreferSimpleConditionFirstTransparentChild(node)
    if !ok || child == nil {
      return node
    }
    node = child
  }
  return nil
}

func unicornPreferSimpleConditionFirstIsTypeScriptWrapper(node *shimast.Node) bool {
  if node == nil {
    return false
  }
  switch node.Kind {
  case shimast.KindAsExpression,
    shimast.KindSatisfiesExpression,
    shimast.KindNonNullExpression,
    shimast.KindTypeAssertionExpression:
    return true
  }
  return false
}

func unicornPreferSimpleConditionFirstTransparentChild(node *shimast.Node) (*shimast.Node, bool) {
  if node == nil {
    return nil, false
  }
  switch node.Kind {
  case shimast.KindParenthesizedExpression:
    expression := node.AsParenthesizedExpression()
    if expression != nil {
      return expression.Expression, true
    }
  case shimast.KindAsExpression:
    expression := node.AsAsExpression()
    if expression != nil {
      return expression.Expression, true
    }
  case shimast.KindSatisfiesExpression:
    expression := node.AsSatisfiesExpression()
    if expression != nil {
      return expression.Expression, true
    }
  case shimast.KindNonNullExpression:
    expression := node.AsNonNullExpression()
    if expression != nil {
      return expression.Expression, true
    }
  case shimast.KindTypeAssertionExpression:
    expression := node.AsTypeAssertion()
    if expression != nil {
      return expression.Expression, true
    }
  }
  return nil, false
}

func init() {
  Register(unicornPreferSimpleConditionFirst{})
}
