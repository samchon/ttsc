// Bulk implementation of ESLint's "Suggestions" category — rules that
// don't catch outright bugs but flag stylistic or maintainability
// patterns. AST-only, no scope analysis.
package linthost

import (
  "strings"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimscanner "github.com/microsoft/typescript-go/shim/scanner"
)

// noAlert: `alert()` / `confirm()` / `prompt()`. Rarely the right
// answer in production code.
type noAlert struct{}

func (noAlert) Name() string           { return "no-alert" }
func (noAlert) Visits() []shimast.Kind { return []shimast.Kind{shimast.KindCallExpression} }
func (noAlert) Check(ctx *Context, node *shimast.Node) {
  call := node.AsCallExpression()
  if call == nil {
    return
  }
  switch callCalleeName(call) {
  case "alert", "confirm", "prompt":
    ctx.Report(node, "Unexpected "+callCalleeName(call)+".")
  }
}

// noBitwise: `&`, `|`, `^`, `~`, `<<`, `>>`, `>>>` — almost always a
// typo for the boolean-logic operators.
type noBitwise struct{}

func (noBitwise) Name() string { return "no-bitwise" }
func (noBitwise) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindBinaryExpression, shimast.KindPrefixUnaryExpression}
}
func (noBitwise) Check(ctx *Context, node *shimast.Node) {
  if node.Kind == shimast.KindBinaryExpression {
    expr := node.AsBinaryExpression()
    if expr == nil || expr.OperatorToken == nil {
      return
    }
    switch expr.OperatorToken.Kind {
    case shimast.KindAmpersandToken,
      shimast.KindBarToken,
      shimast.KindCaretToken,
      shimast.KindLessThanLessThanToken,
      shimast.KindGreaterThanGreaterThanToken,
      shimast.KindGreaterThanGreaterThanGreaterThanToken,
      shimast.KindAmpersandEqualsToken,
      shimast.KindBarEqualsToken,
      shimast.KindCaretEqualsToken,
      shimast.KindLessThanLessThanEqualsToken,
      shimast.KindGreaterThanGreaterThanEqualsToken,
      shimast.KindGreaterThanGreaterThanGreaterThanEqualsToken:
      ctx.Report(node, "Unexpected use of bitwise operator.")
    }
    return
  }
  prefix := node.AsPrefixUnaryExpression()
  if prefix == nil {
    return
  }
  if prefix.Operator == shimast.KindTildeToken {
    ctx.Report(node, "Unexpected use of bitwise operator.")
  }
}

// noCaller: `arguments.caller` / `arguments.callee` — strict-mode
// errors elsewhere; lint catches them earlier.
type noCaller struct{}

func (noCaller) Name() string           { return "no-caller" }
func (noCaller) Visits() []shimast.Kind { return []shimast.Kind{shimast.KindPropertyAccessExpression} }
func (noCaller) Check(ctx *Context, node *shimast.Node) {
  access := node.AsPropertyAccessExpression()
  if access == nil {
    return
  }
  if identifierText(access.Expression) != "arguments" {
    return
  }
  switch identifierText(access.Name()) {
  case "caller", "callee":
    ctx.Report(node, "Avoid arguments."+identifierText(access.Name())+".")
  }
}

// noCaseDeclarations: `switch (x) { case 1: let y = 2; break; }` —
// block-scoped declarations leak across case labels.
type noCaseDeclarations struct{}

func (noCaseDeclarations) Name() string { return "no-case-declarations" }
func (noCaseDeclarations) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindCaseClause, shimast.KindDefaultClause}
}
func (noCaseDeclarations) Check(ctx *Context, node *shimast.Node) {
  clause := node.AsCaseOrDefaultClause()
  if clause == nil || clause.Statements == nil {
    return
  }
  for _, stmt := range clause.Statements.Nodes {
    if stmt == nil {
      continue
    }
    if stmt.Kind == shimast.KindVariableStatement {
      vstmt := stmt.AsVariableStatement()
      if vstmt != nil && vstmt.DeclarationList != nil && !shimast.IsVar(vstmt.DeclarationList) {
        ctx.Report(stmt, "Unexpected lexical declaration in case block.")
        continue
      }
    }
    switch stmt.Kind {
    case shimast.KindFunctionDeclaration, shimast.KindClassDeclaration:
      ctx.Report(stmt, "Unexpected lexical declaration in case block.")
    }
  }
}

// noContinue: `continue` keyword. ESLint flags it as a code-smell
// (loop body should usually be reorganized).
type noContinue struct{}

func (noContinue) Name() string           { return "no-continue" }
func (noContinue) Visits() []shimast.Kind { return []shimast.Kind{shimast.KindContinueStatement} }
func (noContinue) Check(ctx *Context, node *shimast.Node) {
  ctx.Report(node, "Unexpected use of continue statement.")
}

// noDeleteVar: `delete x` where `x` is a variable. Strict-mode error.
type noDeleteVar struct{}

func (noDeleteVar) Name() string           { return "no-delete-var" }
func (noDeleteVar) Visits() []shimast.Kind { return []shimast.Kind{shimast.KindDeleteExpression} }
func (noDeleteVar) Check(ctx *Context, node *shimast.Node) {
  del := node.AsDeleteExpression()
  if del == nil {
    return
  }
  if del.Expression != nil && del.Expression.Kind == shimast.KindIdentifier {
    ctx.Report(node, "Variables should not be deleted.")
  }
}

// noEqNull: `x == null` — ambiguous with eqeqeq's `null` exception
// when developers want to also catch `undefined`.
type noEqNull struct{}

func (noEqNull) Name() string           { return "no-eq-null" }
func (noEqNull) Visits() []shimast.Kind { return []shimast.Kind{shimast.KindBinaryExpression} }
func (noEqNull) Check(ctx *Context, node *shimast.Node) {
  expr := node.AsBinaryExpression()
  if expr == nil || expr.OperatorToken == nil {
    return
  }
  if expr.OperatorToken.Kind != shimast.KindEqualsEqualsToken && expr.OperatorToken.Kind != shimast.KindExclamationEqualsToken {
    return
  }
  if isNullLiteral(expr.Left) || isNullLiteral(expr.Right) {
    ctx.Report(node, "Use '===' to compare with null.")
  }
}

func isNullLiteral(node *shimast.Node) bool {
  return node != nil && node.Kind == shimast.KindNullKeyword
}

// noExtraBind reports `.bind(thisArg)` on arrow functions and regular
// functions whose own lexical/function scope never reads `this`. Calls that
// also bind ordinary arguments are partial applications and remain untouched.
// https://eslint.org/docs/latest/rules/no-extra-bind
type noExtraBind struct{}

func (noExtraBind) Name() string           { return "no-extra-bind" }
func (noExtraBind) Visits() []shimast.Kind { return []shimast.Kind{shimast.KindCallExpression} }
func (noExtraBind) Check(ctx *Context, node *shimast.Node) {
  call := node.AsCallExpression()
  target, member, receiver, ok := noExtraBindCallParts(call)
  if !ok {
    return
  }
  if target.Kind == shimast.KindFunctionExpression && functionScopeReferencesThis(target) {
    return
  }

  edits := noExtraBindFixEdits(ctx, node, call, member, receiver)
  if len(edits) == 0 {
    ctx.Report(node, "The function binding is unnecessary.")
  } else {
    ctx.ReportFix(node, "The function binding is unnecessary.", edits...)
  }
}

// noExtraBindCallParts recognizes the complete syntactic bind call. Static
// computed keys and optional member/call chains are accepted, but a dynamic
// computed property is not assumed to be Function.prototype.bind. Exactly one
// non-spread argument is required: zero arguments are not the canonical bind
// shape, while later arguments perform meaningful partial application.
func noExtraBindCallParts(call *shimast.CallExpression) (
  target *shimast.Node,
  member *shimast.Node,
  receiver *shimast.Node,
  ok bool,
) {
  if call == nil || call.Expression == nil || call.Arguments == nil || len(call.Arguments.Nodes) != 1 {
    return nil, nil, nil, false
  }
  receiver = call.Arguments.Nodes[0]
  if receiver == nil || receiver.Kind == shimast.KindSpreadElement {
    return nil, nil, nil, false
  }

  member = stripParens(call.Expression)
  parts, matched := referenceMemberParts(member)
  if !matched || parts.private || parts.staticKey == nil || *parts.staticKey != "bind" {
    return nil, nil, nil, false
  }
  target = stripParens(parts.object)
  if target == nil || (target.Kind != shimast.KindArrowFunction && target.Kind != shimast.KindFunctionExpression) {
    return nil, nil, nil, false
  }
  return target, member, receiver, true
}

// functionScopeReferencesThis searches the bound regular function itself.
// Nested arrows inherit that function's `this`; nested regular functions and
// class-owned initializers do not. Computed class/object keys and decorators
// are evaluated outside their owning method or field, so their `this` still
// belongs to the enclosing function.
func functionScopeReferencesThis(root *shimast.Node) bool {
  if root == nil {
    return false
  }
  var visit func(*shimast.Node) bool
  visit = func(node *shimast.Node) bool {
    if node == nil {
      return false
    }
    if node.Kind == shimast.KindThisKeyword {
      return noExtraBindThisBelongsToFunction(node, root)
    }
    found := false
    node.ForEachChild(func(child *shimast.Node) bool {
      found = visit(child)
      return found
    })
    return found
  }
  return visit(root)
}

func noExtraBindThisBelongsToFunction(node, root *shimast.Node) bool {
  outerEvaluation := false
  for ancestor := node.Parent; ancestor != nil; ancestor = ancestor.Parent {
    if ancestor == root {
      return true
    }
    switch ancestor.Kind {
    case shimast.KindComputedPropertyName, shimast.KindDecorator:
      outerEvaluation = true
    case shimast.KindClassDeclaration, shimast.KindClassExpression:
      // A class decorator runs outside that class, but still inside any
      // enclosing method/function. Do not carry its marker across the class
      // and accidentally skip an unrelated outer method boundary.
      outerEvaluation = false
    case shimast.KindClassStaticBlockDeclaration:
      return false
    case shimast.KindPropertyDeclaration:
      if outerEvaluation {
        outerEvaluation = false
        continue
      }
      return false
    case shimast.KindArrowFunction:
      continue
    }
    if !isFunctionLikeKind(ancestor) {
      continue
    }
    switch ancestor.Kind {
    case shimast.KindMethodDeclaration,
      shimast.KindGetAccessor,
      shimast.KindSetAccessor,
      shimast.KindConstructor:
      if outerEvaluation {
        outerEvaluation = false
        continue
      }
    }
    return false
  }
  return false
}

// noExtraBindFixEdits removes the member access and its one-argument call as
// separate ranges. Parentheses and comments before the member operator remain
// byte-for-byte intact. The fix is withheld when evaluating the receiver may
// have effects or when any comment lies inside discarded syntax.
func noExtraBindFixEdits(
  ctx *Context,
  callNode *shimast.Node,
  call *shimast.CallExpression,
  member *shimast.Node,
  receiver *shimast.Node,
) []TextEdit {
  if ctx == nil || ctx.File == nil || callNode == nil || call == nil || call.Expression == nil || member == nil ||
    !noExtraBindReceiverIsSideEffectFree(receiver) {
    return nil
  }
  parts, ok := referenceMemberParts(member)
  if !ok || parts.object == nil {
    return nil
  }

  src := ctx.File.Text()
  memberStart := shimscanner.SkipTrivia(src, parts.object.End())
  memberEnd := member.End()
  callStart := shimscanner.SkipTrivia(src, call.Expression.End())
  callEnd := callNode.End()
  if memberStart < 0 || memberStart >= memberEnd || memberEnd > callStart || callStart >= callEnd || callEnd > len(src) {
    return nil
  }
  if hasCommentBetween(src, memberStart, callEnd) {
    return nil
  }
  return []TextEdit{
    {Pos: memberStart, End: memberEnd, Text: ""},
    {Pos: callStart, End: callEnd, Text: ""},
  }
}

func noExtraBindReceiverIsSideEffectFree(node *shimast.Node) bool {
  node = stripParens(node)
  if node == nil {
    return false
  }
  return isLiteralExpression(node) ||
    node.Kind == shimast.KindIdentifier ||
    node.Kind == shimast.KindThisKeyword ||
    node.Kind == shimast.KindFunctionExpression
}

// noLabels: labels (`outer: for (...) { break outer; }`) are
// confusing and rarely needed.
type noLabels struct{}

func (noLabels) Name() string           { return "no-labels" }
func (noLabels) Visits() []shimast.Kind { return []shimast.Kind{shimast.KindLabeledStatement} }
func (noLabels) Check(ctx *Context, node *shimast.Node) {
  ctx.Report(node, "Unexpected labeled statement.")
}

// noLoneBlocks: `{ doStuff(); }` outside a control flow context —
// the braces add no scope (in non-strict mode) and obscure intent.
type noLoneBlocks struct{}

func (noLoneBlocks) Name() string           { return "no-lone-blocks" }
func (noLoneBlocks) Visits() []shimast.Kind { return []shimast.Kind{shimast.KindBlock} }
func (noLoneBlocks) Check(ctx *Context, node *shimast.Node) {
  parent := node.Parent
  if parent == nil {
    return
  }
  switch parent.Kind {
  case shimast.KindBlock, shimast.KindSourceFile, shimast.KindModuleBlock:
  default:
    // Block is the body of a control-flow statement (if/for/while/…) —
    // those braces are not lone; only report blocks nested inside another
    // statement list (another Block, SourceFile, or ModuleBlock).
    return
  }
  // isFunctionLikeKind returns false for all three parent kinds above
  // (Block/SourceFile/ModuleBlock are never function-like), so this guard
  // is a no-op. It is left in place to document intent: if the switch were
  // ever widened to admit function-body containers, this guard would fire.
  if isFunctionLikeKind(parent) {
    return
  }
  block := node.AsBlock()
  if block == nil || block.Statements == nil {
    return
  }
  // Empty block is `no-empty`'s domain.
  if len(block.Statements.Nodes) == 0 {
    return
  }
  // Allow blocks whose only contents are block-scoped declarations
  // (`{ const x = 1; }` is occasionally used to limit scope).
  for _, stmt := range block.Statements.Nodes {
    if stmt == nil {
      continue
    }
    if stmt.Kind == shimast.KindVariableStatement {
      vstmt := stmt.AsVariableStatement()
      if vstmt != nil && vstmt.DeclarationList != nil && !shimast.IsVar(vstmt.DeclarationList) {
        return
      }
    }
    if stmt.Kind == shimast.KindClassDeclaration || stmt.Kind == shimast.KindFunctionDeclaration {
      return
    }
  }
  ctx.Report(node, "Block is redundant.")
}

// noLonelyIf: `else { if (...) {...} }` should be `else if (...)`.
type noLonelyIf struct{}

func (noLonelyIf) Name() string           { return "no-lonely-if" }
func (noLonelyIf) Visits() []shimast.Kind { return []shimast.Kind{shimast.KindIfStatement} }
func (noLonelyIf) Check(ctx *Context, node *shimast.Node) {
  parent := node.Parent
  if parent == nil || parent.Kind != shimast.KindBlock {
    return
  }
  block := parent.AsBlock()
  if block == nil || block.Statements == nil {
    return
  }
  if len(block.Statements.Nodes) != 1 {
    return
  }
  grand := parent.Parent
  if grand == nil || grand.Kind != shimast.KindIfStatement {
    return
  }
  gif := grand.AsIfStatement()
  if gif == nil || gif.ElseStatement != parent {
    return
  }
  ctx.Report(node, "Unexpected if as the only statement in an else block.")
}

// noMultiAssign: `a = b = 1`. Confusing right-to-left chains.
type noMultiAssign struct{}

func (noMultiAssign) Name() string           { return "no-multi-assign" }
func (noMultiAssign) Visits() []shimast.Kind { return []shimast.Kind{shimast.KindBinaryExpression} }
func (noMultiAssign) Check(ctx *Context, node *shimast.Node) {
  expr := node.AsBinaryExpression()
  if expr == nil || expr.OperatorToken == nil {
    return
  }
  if expr.OperatorToken.Kind != shimast.KindEqualsToken {
    return
  }
  if expr.Right != nil && expr.Right.Kind == shimast.KindBinaryExpression {
    inner := expr.Right.AsBinaryExpression()
    if inner != nil && inner.OperatorToken != nil && inner.OperatorToken.Kind == shimast.KindEqualsToken {
      ctx.Report(node, "Unexpected chained assignment.")
    }
  }
}

// noNegatedCondition: `if (!x) {} else {}`. Easier to read with the
// branches swapped.
type noNegatedCondition struct{}

func (noNegatedCondition) Name() string { return "no-negated-condition" }
func (noNegatedCondition) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindIfStatement, shimast.KindConditionalExpression}
}
func (noNegatedCondition) Check(ctx *Context, node *shimast.Node) {
  if node.Kind == shimast.KindIfStatement {
    stmt := node.AsIfStatement()
    if stmt == nil || stmt.ElseStatement == nil {
      return
    }
    // Allow `else if` chains — the branches aren't symmetric.
    if stmt.ElseStatement.Kind == shimast.KindIfStatement {
      return
    }
    if isNegatedExpression(stmt.Expression) {
      ctx.Report(node, "Unexpected negated condition.")
    }
    return
  }
  cond := node.AsConditionalExpression()
  if cond == nil {
    return
  }
  if isNegatedExpression(cond.Condition) {
    ctx.Report(node, "Unexpected negated condition.")
  }
}

func isNegatedExpression(node *shimast.Node) bool {
  expr := stripParens(node)
  if expr == nil {
    return false
  }
  if expr.Kind == shimast.KindPrefixUnaryExpression {
    prefix := expr.AsPrefixUnaryExpression()
    if prefix != nil && prefix.Operator == shimast.KindExclamationToken {
      return true
    }
  }
  if expr.Kind == shimast.KindBinaryExpression {
    bin := expr.AsBinaryExpression()
    if bin != nil && bin.OperatorToken != nil {
      switch bin.OperatorToken.Kind {
      case shimast.KindExclamationEqualsToken, shimast.KindExclamationEqualsEqualsToken:
        return true
      }
    }
  }
  return false
}

// noNestedTernary: `a ? b : c ? d : e`.
type noNestedTernary struct{}

func (noNestedTernary) Name() string { return "no-nested-ternary" }
func (noNestedTernary) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindConditionalExpression}
}
func (noNestedTernary) Check(ctx *Context, node *shimast.Node) {
  cond := node.AsConditionalExpression()
  if cond == nil {
    return
  }
  if hasConditional(cond.WhenTrue) || hasConditional(cond.WhenFalse) {
    ctx.Report(node, "Do not nest ternary expressions.")
  }
}

func hasConditional(node *shimast.Node) bool {
  expr := stripParens(node)
  return expr != nil && expr.Kind == shimast.KindConditionalExpression
}

// noNew: `new Foo()` whose result is discarded. Either store it or
// avoid the constructor.
type noNew struct{}

func (noNew) Name() string           { return "no-new" }
func (noNew) Visits() []shimast.Kind { return []shimast.Kind{shimast.KindExpressionStatement} }
func (noNew) Check(ctx *Context, node *shimast.Node) {
  stmt := node.AsExpressionStatement()
  if stmt == nil || stmt.Expression == nil {
    return
  }
  if stmt.Expression.Kind == shimast.KindNewExpression {
    ctx.Report(node, "Do not use 'new' for side effects.")
  }
}

// noNewFunc: `new Function("...")` — a third form of dynamic eval.
type noNewFunc struct{}

func (noNewFunc) Name() string { return "no-new-func" }
func (noNewFunc) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindNewExpression, shimast.KindCallExpression}
}
func (noNewFunc) Check(ctx *Context, node *shimast.Node) {
  var callee *shimast.Node
  if node.Kind == shimast.KindNewExpression {
    callee = node.AsNewExpression().Expression
  } else {
    callee = node.AsCallExpression().Expression
  }
  if identifierText(callee) == "Function" {
    ctx.Report(node, "The Function constructor is eval.")
  }
}

// noObjectConstructor: `new Object()` / `Object()` — same shape as
// noArrayConstructor but for objects.
type noObjectConstructor struct{}

func (noObjectConstructor) Name() string { return "no-object-constructor" }
func (noObjectConstructor) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindNewExpression, shimast.KindCallExpression}
}
func (noObjectConstructor) Check(ctx *Context, node *shimast.Node) {
  var callee *shimast.Node
  var argCount int
  if node.Kind == shimast.KindNewExpression {
    ne := node.AsNewExpression()
    callee = ne.Expression
    if ne.Arguments != nil {
      argCount = len(ne.Arguments.Nodes)
    }
  } else {
    call := node.AsCallExpression()
    callee = call.Expression
    if call.Arguments != nil {
      argCount = len(call.Arguments.Nodes)
    }
  }
  if argCount != 0 {
    return // 1+ args is a "make a wrapper", not "make an empty object".
  }
  if identifierText(callee) == "Object" {
    ctx.Report(node, "The object literal notation {} is preferable.")
  }
}

// noOctalEscape: `"\251"` — octal escapes in string literals are
// deprecated and forbidden in template literals.
type noOctalEscape struct{}

func (noOctalEscape) Name() string { return "no-octal-escape" }
func (noOctalEscape) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindStringLiteral, shimast.KindNoSubstitutionTemplateLiteral}
}
func (noOctalEscape) Check(ctx *Context, node *shimast.Node) {
  src := nodeText(ctx.File, node)
  if hasOctalEscape(src) {
    ctx.Report(node, "Don't use octal escape sequences.")
  }
}

func hasOctalEscape(src string) bool {
  for i := 0; i < len(src)-1; i++ {
    if src[i] != '\\' {
      continue
    }
    next := src[i+1]
    // A literal `\0` followed by a non-digit is not an octal
    // escape, just NUL — those are allowed.
    if next < '0' || next > '7' {
      i++
      continue
    }
    if next == '0' {
      if i+2 >= len(src) || src[i+2] < '0' || src[i+2] > '9' {
        i++
        continue
      }
    }
    return true
  }
  return false
}

// noPlusplus: `++x` / `x++`. Equivalent to `x += 1`, considered less
// clear in some style guides.
type noPlusPlus struct{}

func (noPlusPlus) Name() string { return "no-plusplus" }
func (noPlusPlus) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindPrefixUnaryExpression, shimast.KindPostfixUnaryExpression}
}
func (noPlusPlus) Check(ctx *Context, node *shimast.Node) {
  var op shimast.Kind
  if node.Kind == shimast.KindPrefixUnaryExpression {
    op = node.AsPrefixUnaryExpression().Operator
  } else {
    op = node.AsPostfixUnaryExpression().Operator
  }
  switch op {
  case shimast.KindPlusPlusToken, shimast.KindMinusMinusToken:
    ctx.Report(node, "Unary operator '++'/'--' used.")
  }
}

// noRegexSpaces: multiple spaces in a regex literal — confusing
// because the count is invisible.
type noRegexSpaces struct{}

func (noRegexSpaces) Name() string { return "no-regex-spaces" }
func (noRegexSpaces) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindRegularExpressionLiteral}
}
func (noRegexSpaces) Check(ctx *Context, node *shimast.Node) {
  src := nodeText(ctx.File, node)
  if regexHasMultipleSpaces(src) {
    ctx.Report(node, "Spaces are hard to count. Use {N}.")
  }
}

func regexHasMultipleSpaces(src string) bool {
  // Strip trailing flags.
  end := strings.LastIndex(src, "/")
  if end <= 0 {
    return false
  }
  body := src[:end]
  inClass := false
  run := 0
  for i := 0; i < len(body); i++ {
    c := body[i]
    switch c {
    case '\\':
      i++
      run = 0
    case '[':
      inClass = true
      run = 0
    case ']':
      inClass = false
      run = 0
    case ' ':
      if inClass {
        run = 0
        continue
      }
      run++
      if run >= 2 {
        return true
      }
    default:
      run = 0
    }
  }
  return false
}

// noReturnAssign: `return a = b` mixes assignment with return.
type noReturnAssign struct{}

func (noReturnAssign) Name() string { return "no-return-assign" }
func (noReturnAssign) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindReturnStatement, shimast.KindArrowFunction}
}
func (noReturnAssign) Check(ctx *Context, node *shimast.Node) {
  switch node.Kind {
  case shimast.KindReturnStatement:
    ret := node.AsReturnStatement()
    if ret == nil || ret.Expression == nil {
      return
    }
    if isAssignmentExpression(stripParens(ret.Expression)) {
      ctx.Report(node, "Return statement should not contain assignment.")
    }
  case shimast.KindArrowFunction:
    arrow := node.AsArrowFunction()
    if arrow == nil || arrow.Body == nil || arrow.Body.Kind == shimast.KindBlock {
      return
    }
    if isAssignmentExpression(stripParens(arrow.Body)) {
      ctx.Report(node, "Arrow function should not return an assignment.")
    }
  }
}

// noSequences: `(a, b)` — comma operator. Almost always a confusing
// pattern outside of `for` headers.
type noSequences struct{}

func (noSequences) Name() string           { return "no-sequences" }
func (noSequences) Visits() []shimast.Kind { return []shimast.Kind{shimast.KindBinaryExpression} }
func (noSequences) Check(ctx *Context, node *shimast.Node) {
  expr := node.AsBinaryExpression()
  if expr == nil || expr.OperatorToken == nil {
    return
  }
  if expr.OperatorToken.Kind != shimast.KindCommaToken {
    return
  }
  // `for (a; b; c)` headers naturally use the comma operator;
  // suppress when the parent is a ForStatement initializer/incrementor.
  parent := node.Parent
  if parent != nil && parent.Kind == shimast.KindForStatement {
    return
  }
  // Allow when wrapped in parens (the canonical "I really mean it"
  // idiom).
  if parent != nil && parent.Kind == shimast.KindParenthesizedExpression {
    return
  }
  ctx.Report(node, "Unexpected use of comma operator.")
}

// noShadowRestrictedNames: redeclaring `undefined`, `NaN`, `Infinity`,
// `arguments`, or `eval`.
type noShadowRestrictedNames struct{}

func (noShadowRestrictedNames) Name() string { return "no-shadow-restricted-names" }
func (noShadowRestrictedNames) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindVariableDeclaration, shimast.KindParameter, shimast.KindFunctionDeclaration}
}
func (noShadowRestrictedNames) Check(ctx *Context, node *shimast.Node) {
  var nameNode *shimast.Node
  switch node.Kind {
  case shimast.KindVariableDeclaration:
    nameNode = node.AsVariableDeclaration().Name()
  case shimast.KindParameter:
    nameNode = node.AsParameterDeclaration().Name()
  case shimast.KindFunctionDeclaration:
    nameNode = node.AsFunctionDeclaration().Name()
  }
  name := identifierText(nameNode)
  if name == "" {
    return
  }
  switch name {
  case "undefined", "NaN", "Infinity", "arguments", "eval":
    ctx.Report(node, "Shadowing of global property '"+name+"'.")
  }
}

// noUndefined: literal `undefined` (vs `void 0`). Easier to misuse
// because it's writable in older environments.
type noUndefined struct{}

func (noUndefined) Name() string           { return "no-undefined" }
func (noUndefined) Visits() []shimast.Kind { return []shimast.Kind{shimast.KindIdentifier} }
func (noUndefined) Check(ctx *Context, node *shimast.Node) {
  if identifierText(node) != "undefined" {
    return
  }
  parent := node.Parent
  if parent == nil {
    return
  }
  // Don't flag a declaration *named* `undefined` (noShadowRestrictedNames
  // covers that), or a member-access / object-key position
  // (`x.undefined`, `{ undefined: 1 }`).
  switch parent.Kind {
  case shimast.KindParameter:
    decl := parent.AsParameterDeclaration()
    if decl != nil && decl.Name() != nil && nodesShareLoc(decl.Name(), node) {
      return
    }
  case shimast.KindVariableDeclaration:
    decl := parent.AsVariableDeclaration()
    if decl != nil && decl.Name() != nil && nodesShareLoc(decl.Name(), node) {
      return
    }
  case shimast.KindPropertyAccessExpression:
    access := parent.AsPropertyAccessExpression()
    if access != nil && access.Name() != nil && nodesShareLoc(access.Name(), node) {
      return
    }
  case shimast.KindPropertyAssignment:
    assign := parent.AsPropertyAssignment()
    if assign != nil && assign.Name() != nil && nodesShareLoc(assign.Name(), node) {
      return
    }
  }
  ctx.Report(node, "Unexpected use of undefined.")
}

// nodesShareLoc reports whether two `*ast.Node` references describe the
// same syntactic site. Identity comparison is unreliable when the
// parser exposes its fields through accessor methods that may return
// fresh wrappers; comparing positions works regardless.
func nodesShareLoc(a, b *shimast.Node) bool {
  if a == nil || b == nil {
    return false
  }
  return a == b || (a.Pos() == b.Pos() && a.End() == b.End())
}

// noUnneededTernary: `x ? true : false` → `Boolean(x)` / `!!x`.
type noUnneededTernary struct{}

func (noUnneededTernary) Name() string { return "no-unneeded-ternary" }
func (noUnneededTernary) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindConditionalExpression}
}
func (noUnneededTernary) Check(ctx *Context, node *shimast.Node) {
  cond := node.AsConditionalExpression()
  if cond == nil || cond.Condition == nil {
    return
  }
  t := stripParens(cond.WhenTrue)
  f := stripParens(cond.WhenFalse)
  tBool, tOk := isLiteralBoolean(t)
  fBool, fOk := isLiteralBoolean(f)
  if !(tOk && fOk && tBool != fBool) {
    return
  }
  message := "Unnecessary use of conditional expression for boolean."
  src := ctx.File.Text()
  condStart := shimscanner.SkipTrivia(src, cond.Condition.Pos())
  if condStart < 0 || condStart >= cond.Condition.End() {
    ctx.Report(node, message)
    return
  }
  condText := src[condStart:cond.Condition.End()]
  var replacement string
  if tBool {
    // `cond ? true : false` → `Boolean(cond)`
    replacement = "Boolean(" + condText + ")"
  } else {
    // `cond ? false : true` → `!cond`. Wrap the condition in parentheses
    // when it is not already a primary expression so operator precedence
    // does not flip the meaning (e.g. `a || b` must become `!(a || b)`).
    if needsParensForUnaryNegation(cond.Condition) {
      replacement = "!(" + condText + ")"
    } else {
      replacement = "!" + condText
    }
  }
  editPos := shimscanner.SkipTrivia(src, node.Pos())
  if editPos < 0 || editPos >= node.End() {
    ctx.Report(node, message)
    return
  }
  ctx.ReportFix(
    node,
    message,
    TextEdit{Pos: editPos, End: node.End(), Text: replacement},
  )
}

// needsParensForUnaryNegation reports whether `cond` must be wrapped in
// parentheses before prefixing with `!`. Anything looser than a unary /
// member / primary expression flips precedence when negated. Mirrors
// ESLint's `no-unneeded-ternary` autofix safety check.
func needsParensForUnaryNegation(node *shimast.Node) bool {
  inner := stripParens(node)
  if inner == nil {
    return false
  }
  switch inner.Kind {
  case shimast.KindBinaryExpression,
    shimast.KindConditionalExpression,
    shimast.KindYieldExpression,
    shimast.KindAwaitExpression,
    shimast.KindArrowFunction,
    shimast.KindFunctionExpression,
    shimast.KindAsExpression,
    shimast.KindSatisfiesExpression,
    shimast.KindTypeAssertionExpression:
    return true
  }
  return false
}

// noUnusedExpressions: an expression statement whose value isn't used.
// Direct port of ESLint's default semantics: a disallow-list of
// side-effect-free expression shapes (unknown shapes are ignored, the way
// upstream treats unknown node types), directive prologues exempted by AST
// position rather than by recognized text, and the upstream option set
// (`allowShortCircuit`, `allowTernary`, `allowTaggedTemplates`,
// `enforceForJSX`, `ignoreDirectives`) decoded from the rule's options blob.
type noUnusedExpressions struct{}

// noUnusedExpressionsOptions mirrors the upstream ESLint option object;
// every flag defaults to false, matching the rule's `defaultOptions`.
type noUnusedExpressionsOptions struct {
  AllowShortCircuit    bool `json:"allowShortCircuit"`
  AllowTernary         bool `json:"allowTernary"`
  AllowTaggedTemplates bool `json:"allowTaggedTemplates"`
  EnforceForJSX        bool `json:"enforceForJSX"`
  IgnoreDirectives     bool `json:"ignoreDirectives"`
}

func (noUnusedExpressions) Name() string { return "no-unused-expressions" }
func (noUnusedExpressions) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindExpressionStatement}
}
func (noUnusedExpressions) Check(ctx *Context, node *shimast.Node) {
  stmt := node.AsExpressionStatement()
  if stmt == nil || stmt.Expression == nil {
    return
  }
  var opts noUnusedExpressionsOptions
  _ = ctx.DecodeOptions(&opts)
  if !noUnusedExpressionsDisallows(stmt.Expression, opts) {
    return
  }
  // A directive prologue member ("use strict", "use client", …) is
  // positionally meaningful whatever its text; never report it. The
  // `ignoreDirectives` variant additionally applies upstream's loose
  // ESTree view, in which parentheses are invisible, so a parenthesized
  // string inside the leading string run is exempted too.
  if noUnusedExpressionsIsDirective(node, false) {
    return
  }
  if opts.IgnoreDirectives && noUnusedExpressionsIsDirective(node, true) {
    return
  }
  ctx.Report(node, "Expected an assignment or function call and instead saw an expression.")
}

// noUnusedExpressionsDisallows reports whether expr is a side-effect-free
// shape the rule must flag when it stands alone as a statement. Ports the
// upstream Checker disallow-list: shapes not listed (calls, `new`,
// assignments, updates, `await`, `yield`, `void`, `delete`, dynamic
// `import()`, `satisfies`, …) are ignored, mirroring ESLint's "unknown
// nodes are handled as false" contract. Parenthesized expressions are
// transparent because ESTree has no parenthesized-expression node, and the
// TypeScript wrapper expressions (`as`, angle assertions, non-null `!`,
// instantiation expressions) inherit the classification of the expression
// they wrap.
func noUnusedExpressionsDisallows(expr *shimast.Node, opts noUnusedExpressionsOptions) bool {
  expr = stripParens(expr)
  if expr == nil {
    return false
  }
  switch expr.Kind {
  case shimast.KindArrayLiteralExpression,
    shimast.KindObjectLiteralExpression,
    shimast.KindArrowFunction,
    shimast.KindFunctionExpression,
    shimast.KindClassExpression,
    shimast.KindIdentifier,
    shimast.KindPropertyAccessExpression,
    shimast.KindElementAccessExpression,
    shimast.KindMetaProperty,
    shimast.KindThisKeyword,
    shimast.KindStringLiteral,
    shimast.KindNumericLiteral,
    shimast.KindBigIntLiteral,
    shimast.KindRegularExpressionLiteral,
    shimast.KindTrueKeyword,
    shimast.KindFalseKeyword,
    shimast.KindNullKeyword,
    shimast.KindTemplateExpression,
    shimast.KindNoSubstitutionTemplateLiteral,
    shimast.KindTypeOfExpression:
    return true
  case shimast.KindBinaryExpression:
    bin := expr.AsBinaryExpression()
    if bin == nil || bin.OperatorToken == nil {
      return false
    }
    switch bin.OperatorToken.Kind {
    case shimast.KindAmpersandAmpersandToken,
      shimast.KindBarBarToken,
      shimast.KindQuestionQuestionToken:
      // ESTree LogicalExpression: only the right operand's value goes
      // unused, so `allowShortCircuit` defers to its classification.
      if opts.AllowShortCircuit {
        return noUnusedExpressionsDisallows(bin.Right, opts)
      }
      return true
    }
    if isAssignmentOperator(bin.OperatorToken.Kind) {
      // ESTree AssignmentExpression (including `&&=`, `||=`, `??=`) —
      // productive.
      return false
    }
    // Comma sequences and ordinary binary operators (`a + b`,
    // `a === b`, `key in obj`, …) compute a value nobody reads.
    return true
  case shimast.KindPrefixUnaryExpression:
    prefix := expr.AsPrefixUnaryExpression()
    if prefix == nil {
      return false
    }
    // `++x` / `--x` are ESTree UpdateExpressions (productive); the
    // remaining prefix operators (`+`, `-`, `!`, `~`) are pure.
    return prefix.Operator != shimast.KindPlusPlusToken &&
      prefix.Operator != shimast.KindMinusMinusToken
  case shimast.KindConditionalExpression:
    cond := expr.AsConditionalExpression()
    if cond == nil {
      return false
    }
    if opts.AllowTernary {
      // Disallowed when either result branch is itself side-effect
      // free; recursion keeps nested allowances working.
      return noUnusedExpressionsDisallows(cond.WhenTrue, opts) ||
        noUnusedExpressionsDisallows(cond.WhenFalse, opts)
    }
    return true
  case shimast.KindTaggedTemplateExpression:
    return !opts.AllowTaggedTemplates
  case shimast.KindJsxElement,
    shimast.KindJsxSelfClosingElement,
    shimast.KindJsxFragment:
    return opts.EnforceForJSX
  case shimast.KindAsExpression:
    as := expr.AsAsExpression()
    return as != nil && as.Expression != nil &&
      noUnusedExpressionsDisallows(as.Expression, opts)
  case shimast.KindTypeAssertionExpression:
    assertion := expr.AsTypeAssertion()
    return assertion != nil && assertion.Expression != nil &&
      noUnusedExpressionsDisallows(assertion.Expression, opts)
  case shimast.KindNonNullExpression:
    nonNull := expr.AsNonNullExpression()
    return nonNull != nil && nonNull.Expression != nil &&
      noUnusedExpressionsDisallows(nonNull.Expression, opts)
  case shimast.KindExpressionWithTypeArguments:
    instantiation := expr.AsExpressionWithTypeArguments()
    return instantiation != nil && instantiation.Expression != nil &&
      noUnusedExpressionsDisallows(instantiation.Expression, opts)
  }
  return false
}

// noUnusedExpressionsIsDirective reports whether stmt sits inside its
// container's directive prologue — the leading run of string-literal
// expression statements of a script or module body, a function body, or a
// TypeScript namespace/module block
// (https://tc39.es/ecma262/#directive-prologue). Class static blocks and
// plain nested blocks own no prologue.
//
// seeThroughParens selects the `ignoreDirectives` variant: upstream ESLint
// evaluates that option against an ESTree, which has no
// parenthesized-expression nodes, so the loose variant lets a
// parenthesized string participate in the leading run. The strict variant
// matches the parser's directive notion, where `("use strict")` is not a
// directive and terminates the prologue.
func noUnusedExpressionsIsDirective(stmt *shimast.Node, seeThroughParens bool) bool {
  if stmt == nil || !noUnusedExpressionsCanOwnPrologue(stmt.Parent) {
    return false
  }
  for _, sibling := range parentStatements(stmt.Parent) {
    if !noUnusedExpressionsIsStringStatement(sibling, seeThroughParens) {
      return false
    }
    if nodesShareLoc(sibling, stmt) {
      return true
    }
  }
  return false
}

// noUnusedExpressionsCanOwnPrologue reports whether parent is a statement
// container whose leading string statements form a directive prologue: a
// source file (script or module), a namespace/module block, or the body
// block of a function-like declaration. Mirrors upstream ESLint's
// isTopLevelExpressionStatement (Program | TSModuleBlock | function body).
func noUnusedExpressionsCanOwnPrologue(parent *shimast.Node) bool {
  if parent == nil {
    return false
  }
  switch parent.Kind {
  case shimast.KindSourceFile, shimast.KindModuleBlock:
    return true
  case shimast.KindBlock:
    return isFunctionLikeKind(parent.Parent)
  }
  return false
}

// noUnusedExpressionsIsStringStatement reports whether stmt is an
// expression statement consisting of a string literal — the shape that can
// extend a directive prologue. With seeThroughParens the string may sit
// behind parentheses (the ESTree view used by `ignoreDirectives`).
func noUnusedExpressionsIsStringStatement(stmt *shimast.Node, seeThroughParens bool) bool {
  if stmt == nil || stmt.Kind != shimast.KindExpressionStatement {
    return false
  }
  inner := stmt.AsExpressionStatement()
  if inner == nil || inner.Expression == nil {
    return false
  }
  expr := inner.Expression
  if seeThroughParens {
    expr = stripParens(expr)
  }
  return expr != nil && expr.Kind == shimast.KindStringLiteral
}

// noUselessCall: `func.call(undefined, ...args)` / `func.apply(undefined, args)`
// — call/apply with no this binding is just a regular call.
type noUselessCall struct{}

func (noUselessCall) Name() string           { return "no-useless-call" }
func (noUselessCall) Visits() []shimast.Kind { return []shimast.Kind{shimast.KindCallExpression} }
func (noUselessCall) Check(ctx *Context, node *shimast.Node) {
  call := node.AsCallExpression()
  if call == nil || call.Expression == nil || call.Expression.Kind != shimast.KindPropertyAccessExpression {
    return
  }
  access := call.Expression.AsPropertyAccessExpression()
  method := identifierText(access.Name())
  if method != "call" && method != "apply" {
    return
  }
  if call.Arguments == nil || len(call.Arguments.Nodes) == 0 {
    return
  }
  first := call.Arguments.Nodes[0]
  first = stripParens(first)
  if first == nil {
    return
  }
  if first.Kind == shimast.KindNullKeyword || identifierText(first) == "undefined" {
    ctx.Report(node, "Unnecessary "+method+"().")
  }
}

// noUselessComputedKey: `{ ["foo"]: 1 }` could be `{ foo: 1 }`.
type noUselessComputedKey struct{}

func (noUselessComputedKey) Name() string { return "no-useless-computed-key" }
func (noUselessComputedKey) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindPropertyAssignment, shimast.KindMethodDeclaration}
}
func (noUselessComputedKey) Check(ctx *Context, node *shimast.Node) {
  var name *shimast.Node
  switch node.Kind {
  case shimast.KindPropertyAssignment:
    name = node.AsPropertyAssignment().Name()
  case shimast.KindMethodDeclaration:
    name = node.AsMethodDeclaration().Name()
  }
  if name == nil || name.Kind != shimast.KindComputedPropertyName {
    return
  }
  computed := name.AsComputedPropertyName()
  if computed == nil || computed.Expression == nil {
    return
  }
  // Only fire when the computed key is a string / numeric / template
  // literal — a bare identifier inside `[ ]` reads its *value* and is
  // not equivalent to the same identifier as a static key.
  expr := stripParens(computed.Expression)
  switch expr.Kind {
  case shimast.KindStringLiteral,
    shimast.KindNoSubstitutionTemplateLiteral,
    shimast.KindNumericLiteral,
    shimast.KindBigIntLiteral:
    ctx.Report(name, "Unnecessarily computed property key.")
  }
}

// noUselessRename: `import { x as x } from ...` / `const { x: x } = obj`
// — the rename is a no-op.
type noUselessRename struct{}

func (noUselessRename) Name() string { return "no-useless-rename" }
func (noUselessRename) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindImportSpecifier, shimast.KindExportSpecifier, shimast.KindBindingElement}
}
func (noUselessRename) Check(ctx *Context, node *shimast.Node) {
  switch node.Kind {
  case shimast.KindImportSpecifier:
    spec := node.AsImportSpecifier()
    if spec == nil || spec.PropertyName == nil {
      return
    }
    if sameIdentifierRename(spec.PropertyName, spec.Name()) {
      reportUselessRenameFix(ctx, node, spec.PropertyName, spec.Name(), "Import { x as x } is redundant.")
    }
  case shimast.KindExportSpecifier:
    spec := node.AsExportSpecifier()
    if spec == nil || spec.PropertyName == nil {
      return
    }
    if sameIdentifierRename(spec.PropertyName, spec.Name()) {
      reportUselessRenameFix(ctx, node, spec.PropertyName, spec.Name(), "Export { x as x } is redundant.")
    }
  case shimast.KindBindingElement:
    el := node.AsBindingElement()
    if el == nil || el.PropertyName == nil {
      return
    }
    if sameIdentifierRename(el.PropertyName, el.Name()) {
      reportUselessRenameFix(ctx, node, el.PropertyName, el.Name(), "Destructuring rename to the same name is redundant.")
    }
  }
}

// sameIdentifierRename gates the rename-tail collapse on both sides being
// real Identifier nodes that lex to the same text. Without the kind guard
// a `{ "foo" as "bar" }` pair would compare via `identifierText` ➜ `""`
// on both sides, collapse to `"" == ""`, and the fix would delete
// ` as "bar"` — rebinding the local symbol. Both sides must be
// KindIdentifier (the redundant rename shape ESLint targets).
func sameIdentifierRename(propertyName, name *shimast.Node) bool {
  if propertyName == nil || name == nil {
    return false
  }
  if propertyName.Kind != shimast.KindIdentifier || name.Kind != shimast.KindIdentifier {
    return false
  }
  return identifierText(propertyName) == identifierText(name)
}

// reportUselessRenameFix deletes the rename tail (`<separator> name`) so
// `{ x as x }` collapses to `{ x }` and `{ x: x }` to `{ x }`. The
// separator (` as ` for import/export, `: ` for binding) lives between
// the propertyName's end and the name's start; deleting up to name's End
// removes it without touching surrounding tokens.
func reportUselessRenameFix(ctx *Context, node, propertyName, name *shimast.Node, message string) {
  if propertyName == nil || name == nil {
    ctx.Report(node, message)
    return
  }
  ctx.ReportFix(
    node,
    message,
    TextEdit{Pos: propertyName.End(), End: name.End(), Text: ""},
  )
}

// objectShorthand: `{ x: x }` → `{ x }`.
type objectShorthand struct{}

func (objectShorthand) Name() string           { return "object-shorthand" }
func (objectShorthand) Visits() []shimast.Kind { return []shimast.Kind{shimast.KindPropertyAssignment} }
func (objectShorthand) Check(ctx *Context, node *shimast.Node) {
  prop := node.AsPropertyAssignment()
  if prop == nil || prop.Name() == nil || prop.Initializer == nil {
    return
  }
  keyName := identifierText(prop.Name())
  valueName := identifierText(prop.Initializer)
  if keyName == "" || valueName == "" {
    return
  }
  if keyName != valueName {
    return
  }
  // Delete `: <value>` so `{ x: x }` becomes `{ x }`. The range starts
  // at the end of the property name and ends at the end of the
  // initializer; any whitespace between `:` and the value is part of
  // that range.
  ctx.ReportFix(
    node,
    "Expected property shorthand.",
    TextEdit{Pos: prop.Name().End(), End: prop.Initializer.End(), Text: ""},
  )
}

// operatorAssignment: `x = x + 1` → `x += 1`.
type operatorAssignment struct{}

func (operatorAssignment) Name() string { return "operator-assignment" }
func (operatorAssignment) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindBinaryExpression}
}
func (operatorAssignment) Check(ctx *Context, node *shimast.Node) {
  expr := node.AsBinaryExpression()
  if expr == nil || expr.OperatorToken == nil {
    return
  }
  if expr.OperatorToken.Kind != shimast.KindEqualsToken {
    return
  }
  if expr.Right == nil || expr.Right.Kind != shimast.KindBinaryExpression {
    return
  }
  right := expr.Right.AsBinaryExpression()
  if right == nil || right.OperatorToken == nil {
    return
  }
  if !isCompoundEligibleOperator(right.OperatorToken.Kind) {
    return
  }
  if nodeText(ctx.File, expr.Left) == nodeText(ctx.File, right.Left) {
    ctx.Report(node, "Assignment can be replaced with compound operator.")
  }
}

func isCompoundEligibleOperator(kind shimast.Kind) bool {
  switch kind {
  case shimast.KindPlusToken, shimast.KindAsteriskToken, shimast.KindSlashToken,
    shimast.KindAsteriskAsteriskToken, shimast.KindAmpersandToken, shimast.KindBarToken,
    shimast.KindCaretToken:
    return true
  }
  return false
}

// preferExponentiationOperator: `Math.pow(a, b)` → `a ** b`.
type preferExponentiationOperator struct{}

func (preferExponentiationOperator) Name() string { return "prefer-exponentiation-operator" }
func (preferExponentiationOperator) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindCallExpression}
}
func (preferExponentiationOperator) Check(ctx *Context, node *shimast.Node) {
  call := node.AsCallExpression()
  if call == nil {
    return
  }
  if !isMatchingPropertyAccess(call.Expression, "Math", "pow") {
    return
  }
  ctx.Report(node, "Use the '**' operator instead of 'Math.pow'.")
}

// preferSpread: `fn.apply(null, args)` → `fn(...args)`.
type preferSpread struct{}

func (preferSpread) Name() string           { return "prefer-spread" }
func (preferSpread) Visits() []shimast.Kind { return []shimast.Kind{shimast.KindCallExpression} }
func (preferSpread) Check(ctx *Context, node *shimast.Node) {
  call := node.AsCallExpression()
  if call == nil || call.Expression == nil {
    return
  }
  if call.Expression.Kind != shimast.KindPropertyAccessExpression {
    return
  }
  access := call.Expression.AsPropertyAccessExpression()
  if access == nil || identifierText(access.Name()) != "apply" {
    return
  }
  if call.Arguments == nil || len(call.Arguments.Nodes) != 2 {
    return
  }
  first := stripParens(call.Arguments.Nodes[0])
  if first == nil {
    return
  }
  // ESLint default: only fire when the `this` arg is null/undefined,
  // which is the canonical "I just want to spread" pattern.
  if first.Kind == shimast.KindNullKeyword || identifierText(first) == "undefined" {
    ctx.Report(node, "Use the spread operator instead of '.apply()'.")
  }
}

// preferTemplate: string concatenation that would read better as a
// template literal — heuristic: any `+` involving a string literal AND
// a non-literal.
type preferTemplate struct{}

func (preferTemplate) Name() string           { return "prefer-template" }
func (preferTemplate) Visits() []shimast.Kind { return []shimast.Kind{shimast.KindBinaryExpression} }
func (preferTemplate) Check(ctx *Context, node *shimast.Node) {
  expr := node.AsBinaryExpression()
  if expr == nil || expr.OperatorToken == nil {
    return
  }
  if expr.OperatorToken.Kind != shimast.KindPlusToken {
    return
  }
  // Skip when the parent is also a string-concat — only the topmost
  // `+` chain emits one finding.
  parent := node.Parent
  if parent != nil && parent.Kind == shimast.KindBinaryExpression {
    parentBin := parent.AsBinaryExpression()
    if parentBin != nil && parentBin.OperatorToken != nil && parentBin.OperatorToken.Kind == shimast.KindPlusToken {
      return
    }
  }
  hasString, hasOther := concatChainShape(node)
  if !(hasString && hasOther) {
    return
  }
  message := "Unexpected string concatenation."
  src := ctx.File.Text()
  operands := flattenConcatOperands(node)
  template, ok := renderConcatAsTemplate(src, operands)
  if !ok {
    ctx.Report(node, message)
    return
  }
  editPos := shimscanner.SkipTrivia(src, node.Pos())
  if editPos < 0 || editPos >= node.End() {
    ctx.Report(node, message)
    return
  }
  ctx.ReportFix(
    node,
    message,
    TextEdit{Pos: editPos, End: node.End(), Text: template},
  )
}

func concatChainShape(node *shimast.Node) (hasString bool, hasOther bool) {
  if node == nil {
    return false, false
  }
  if node.Kind == shimast.KindBinaryExpression {
    bin := node.AsBinaryExpression()
    if bin != nil && bin.OperatorToken != nil && bin.OperatorToken.Kind == shimast.KindPlusToken {
      ls, lo := concatChainShape(bin.Left)
      rs, ro := concatChainShape(bin.Right)
      return ls || rs, lo || ro
    }
  }
  if isStringLikeLiteral(stripParens(node)) {
    return true, false
  }
  return false, true
}

// flattenConcatOperands walks a `+` chain left-to-right and returns each
// leaf operand in source order. It only descends into a `+` subtree that
// itself contains a string-like operand (see
// concatChainContainsString): a subtree without one — the `a + b` in
// `a + b + " items"` — evaluates BEFORE any string concatenation, so
// splitting it into separate `${a}${b}` slots would change the runtime
// value (numeric 3 becomes the digits "12"). Such a subtree stays one
// operand and renders as a single `${a + b}` slot, mirroring upstream
// ESLint prefer-template, which embeds non-string sub-chains as one
// expression. Parenthesized sub-expressions are likewise kept as a
// single operand so the rendered template literal does not lose their
// grouping.
func flattenConcatOperands(node *shimast.Node) []*shimast.Node {
  if node == nil {
    return nil
  }
  if node.Kind == shimast.KindBinaryExpression {
    bin := node.AsBinaryExpression()
    if bin != nil && bin.OperatorToken != nil && bin.OperatorToken.Kind == shimast.KindPlusToken && concatChainContainsString(node) {
      out := flattenConcatOperands(bin.Left)
      out = append(out, flattenConcatOperands(bin.Right)...)
      return out
    }
  }
  return []*shimast.Node{node}
}

// concatChainContainsString reports whether a `+` chain (or a single
// operand) contains a string-like operand: a string literal, a template
// literal (with or without substitutions), or a nested `+` chain —
// parenthesized or not — that itself contains one. This is the
// flattening gate for flattenConcatOperands. Once a string-like operand
// appears in a left-associative chain, every later `+` is string
// concatenation, so splitting the chain into template segments preserves
// the value; a chain with none may be numeric addition and must stay
// whole. Parentheses are transparent to the DECISION (`("a" + b) + c`
// is a string chain, so `c` still gets its own slot) even though the
// flattener keeps the parenthesized operand itself as one slot. A
// string-like node under any other operator (e.g. `a * "x"`) does NOT
// qualify: that subexpression coerces away from string, so its chain
// may still be numeric addition.
func concatChainContainsString(node *shimast.Node) bool {
  node = stripParens(node)
  if node == nil {
    return false
  }
  if node.Kind == shimast.KindBinaryExpression {
    bin := node.AsBinaryExpression()
    if bin != nil && bin.OperatorToken != nil && bin.OperatorToken.Kind == shimast.KindPlusToken {
      return concatChainContainsString(bin.Left) || concatChainContainsString(bin.Right)
    }
  }
  return isStringLikeLiteral(node) || node.Kind == shimast.KindTemplateExpression
}

// renderConcatAsTemplate renders the flattened concat operands as a single
// backtick template literal. String-like literals contribute their value
// directly (with template-specific escaping); any other expression becomes
// a `${…}` placeholder copied verbatim from the source text. Returns ok=false
// when an operand cannot be rendered (typically because its source range is
// unavailable), so the caller falls back to detection-only.
//
// Adjacent literal operands are merged into one cooked run BEFORE
// escaping. Escaping each literal on its own cannot see across the seam,
// so `"$" + "{"` would emit `$` then `{` — fusing into a live `${`
// interpolation opener in the rendered template. Escaping the merged run
// makes escapeTemplateLiteralBody's `${` lookahead total over the body.
// The only other seam, a literal's trailing `$` followed by an emitted
// `${…}` placeholder, is safe: `$${expr}` parses as a literal `$` plus
// the interpolation, which matches the original `"$" + expr` value.
func renderConcatAsTemplate(src string, operands []*shimast.Node) (string, bool) {
  if len(operands) == 0 {
    return "", false
  }
  var sb strings.Builder
  var literal strings.Builder
  flushLiteral := func() {
    if literal.Len() > 0 {
      sb.WriteString(escapeTemplateLiteralBody(literal.String()))
      literal.Reset()
    }
  }
  sb.WriteByte('`')
  for _, operand := range operands {
    if operand == nil {
      return "", false
    }
    inner := stripParens(operand)
    if isStringLikeLiteral(inner) {
      literal.WriteString(stringLiteralText(inner))
      continue
    }
    pos := shimscanner.SkipTrivia(src, operand.Pos())
    end := operand.End()
    if pos < 0 || pos >= end || end > len(src) {
      return "", false
    }
    flushLiteral()
    sb.WriteString("${")
    sb.WriteString(src[pos:end])
    sb.WriteByte('}')
  }
  flushLiteral()
  sb.WriteByte('`')
  return sb.String(), true
}

// escapeTemplateLiteralBody escapes the characters that would otherwise
// terminate or interpolate a template literal body: backslash, backtick,
// and the `${` sequence. Matches the canonical ESLint `prefer-template`
// fixer escape set.
//
// The input is the COOKED string value, so it carries decoded line
// terminators. A raw CR (or CRLF) emitted into a template body is
// normalized to LF by the ECMAScript template-literal grammar, and a raw
// LF/TAB would change the literal's whitespace layout, so those control
// characters are emitted as backslash escapes (`\r`, `\n`, `\t`) to keep
// the template's cooked value byte-for-byte identical to the original.
func escapeTemplateLiteralBody(text string) string {
  var sb strings.Builder
  sb.Grow(len(text))
  for i := 0; i < len(text); i++ {
    ch := text[i]
    switch ch {
    case '\\', '`':
      sb.WriteByte('\\')
      sb.WriteByte(ch)
    case '\r':
      sb.WriteString("\\r")
    case '\n':
      sb.WriteString("\\n")
    case '\t':
      sb.WriteString("\\t")
    case '$':
      if i+1 < len(text) && text[i+1] == '{' {
        sb.WriteString("\\$")
      } else {
        sb.WriteByte('$')
      }
    default:
      sb.WriteByte(ch)
    }
  }
  return sb.String()
}

// requireYield: `function* gen() { return 1; }` — generators that
// never yield are usually unintended.
type requireYield struct{}

func (requireYield) Name() string { return "require-yield" }
func (requireYield) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindFunctionDeclaration, shimast.KindFunctionExpression, shimast.KindMethodDeclaration}
}
func (requireYield) Check(ctx *Context, node *shimast.Node) {
  if !hasAsteriskModifier(node) {
    return
  }
  body := node.Body()
  if body == nil {
    return
  }
  if !subtreeContainsYield(body) {
    ctx.Report(node, "This generator function does not have 'yield'.")
  }
}

func hasAsteriskModifier(node *shimast.Node) bool {
  if node == nil {
    return false
  }
  switch node.Kind {
  case shimast.KindFunctionDeclaration:
    decl := node.AsFunctionDeclaration()
    return decl != nil && decl.AsteriskToken != nil
  case shimast.KindFunctionExpression:
    decl := node.AsFunctionExpression()
    return decl != nil && decl.AsteriskToken != nil
  case shimast.KindMethodDeclaration:
    decl := node.AsMethodDeclaration()
    return decl != nil && decl.AsteriskToken != nil
  }
  return false
}

func subtreeContainsYield(node *shimast.Node) bool {
  if node == nil {
    return false
  }
  if node.Kind == shimast.KindYieldExpression {
    return true
  }
  if isFunctionLikeKind(node) && node.Parent != nil {
    return false
  }
  found := false
  node.ForEachChild(func(child *shimast.Node) bool {
    if subtreeContainsYield(child) {
      found = true
      return true
    }
    return false
  })
  return found
}

// varsOnTop: `var` declarations should appear at the top of their
// function/script scope.
type varsOnTop struct{}

func (varsOnTop) Name() string           { return "vars-on-top" }
func (varsOnTop) Visits() []shimast.Kind { return []shimast.Kind{shimast.KindVariableStatement} }
func (varsOnTop) Check(ctx *Context, node *shimast.Node) {
  stmt := node.AsVariableStatement()
  if stmt == nil || stmt.DeclarationList == nil {
    return
  }
  if !shimast.IsVar(stmt.DeclarationList) {
    return
  }
  parent := node.Parent
  if parent == nil {
    return
  }
  switch parent.Kind {
  case shimast.KindSourceFile, shimast.KindModuleBlock:
  case shimast.KindBlock:
    grand := parent.Parent
    if grand == nil || !isFunctionLikeKind(grand) {
      ctx.Report(node, "All 'var' declarations must be at the top of the function scope.")
      return
    }
  default:
    ctx.Report(node, "All 'var' declarations must be at the top of the function scope.")
    return
  }
  // Same-block: must be the first non-trivial statement.
  siblings := parentStatements(parent)
  for _, sib := range siblings {
    if sib == node {
      return
    }
    if sib.Kind == shimast.KindVariableStatement {
      continue
    }
    ctx.Report(node, "All 'var' declarations must be at the top of the function scope.")
    return
  }
}

func parentStatements(parent *shimast.Node) []*shimast.Node {
  if parent == nil {
    return nil
  }
  switch parent.Kind {
  case shimast.KindBlock:
    block := parent.AsBlock()
    if block != nil && block.Statements != nil {
      return block.Statements.Nodes
    }
  case shimast.KindSourceFile:
    file := parent.AsSourceFile()
    if file != nil && file.Statements != nil {
      return file.Statements.Nodes
    }
  case shimast.KindModuleBlock:
    mb := parent.AsModuleBlock()
    if mb != nil && mb.Statements != nil {
      return mb.Statements.Nodes
    }
  }
  return nil
}

// yoda: `if (1 === x)` — ESLint flags literals on the left of a
// comparison as "yoda conditions". Default mode forbids them.
type yoda struct{}

func (yoda) Name() string           { return "yoda" }
func (yoda) Visits() []shimast.Kind { return []shimast.Kind{shimast.KindBinaryExpression} }
func (yoda) Check(ctx *Context, node *shimast.Node) {
  expr := node.AsBinaryExpression()
  if expr == nil || expr.OperatorToken == nil {
    return
  }
  if !isComparisonOperator(expr.OperatorToken.Kind) {
    return
  }
  if isLiteralExpression(stripParens(expr.Left)) && !isLiteralExpression(stripParens(expr.Right)) {
    ctx.Report(node, "Expected literal to be on the right side of comparison.")
  }
}

func init() {
  Register(noAlert{})
  Register(noBitwise{})
  Register(noCaller{})
  Register(noCaseDeclarations{})
  Register(noContinue{})
  Register(noDeleteVar{})
  Register(noEqNull{})
  Register(noExtraBind{})
  Register(noLabels{})
  Register(noLoneBlocks{})
  Register(noLonelyIf{})
  Register(noMultiAssign{})
  Register(noNegatedCondition{})
  Register(noNestedTernary{})
  Register(noNew{})
  Register(noNewFunc{})
  Register(noObjectConstructor{})
  Register(noOctalEscape{})
  Register(noPlusPlus{})
  Register(noRegexSpaces{})
  Register(noReturnAssign{})
  Register(noSequences{})
  Register(noShadowRestrictedNames{})
  Register(noUndefined{})
  Register(noUnneededTernary{})
  Register(noUnusedExpressions{})
  Register(noUselessCall{})
  Register(noUselessComputedKey{})
  Register(noUselessRename{})
  Register(objectShorthand{})
  Register(operatorAssignment{})
  Register(preferExponentiationOperator{})
  Register(preferSpread{})
  Register(preferTemplate{})
  Register(requireYield{})
  Register(varsOnTop{})
  Register(yoda{})
}
