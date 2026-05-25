package linthost

import (
  "encoding/json"
  "strings"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

type cypressNoAssigningReturnValues struct{}
type cypressNoUnnecessaryWaiting struct{}
type cypressNoForce struct{}
type cypressNoPause struct{}
type cypressNoDebug struct{}
type cypressUnsafeToChainCommand struct{}
type cypressAssertionBeforeScreenshot struct{}
type cypressNoAsyncTests struct{}
type cypressNoAsyncBefore struct{}
type cypressNoAnd struct{}
type cypressNoChainedGet struct{}
type cypressNoXpath struct{}
type cypressRequireDataSelectors struct{}

func (cypressNoAssigningReturnValues) Name() string { return "cypress/no-assigning-return-values" }
func (cypressNoAssigningReturnValues) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindVariableDeclaration, shimast.KindBinaryExpression}
}
func (cypressNoAssigningReturnValues) Check(ctx *Context, node *shimast.Node) {
  switch node.Kind {
  case shimast.KindVariableDeclaration:
    decl := node.AsVariableDeclaration()
    if decl == nil || decl.Initializer == nil || !isCypressChain(decl.Initializer) {
      return
    }
    ctx.Report(node, "Do not assign the return value of a Cypress command.")
  case shimast.KindBinaryExpression:
    expr := node.AsBinaryExpression()
    if expr == nil || expr.OperatorToken == nil || expr.OperatorToken.Kind != shimast.KindEqualsToken {
      return
    }
    if isCypressChain(expr.Right) {
      ctx.Report(node, "Do not assign the return value of a Cypress command.")
    }
  }
}

func (cypressNoUnnecessaryWaiting) Name() string { return "cypress/no-unnecessary-waiting" }
func (cypressNoUnnecessaryWaiting) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindCallExpression}
}
func (cypressNoUnnecessaryWaiting) Check(ctx *Context, node *shimast.Node) {
  call := node.AsCallExpression()
  if call == nil || cypressCallMethod(call) != "wait" || !hasCypressRoot(call.Expression) {
    return
  }
  if call.Arguments == nil || len(call.Arguments.Nodes) == 0 {
    return
  }
  first := stripParens(call.Arguments.Nodes[0])
  if first != nil && first.Kind == shimast.KindNumericLiteral {
    ctx.Report(node, "Do not wait for arbitrary time periods.")
  }
}

func (cypressNoForce) Name() string { return "cypress/no-force" }
func (cypressNoForce) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindCallExpression}
}
func (cypressNoForce) Check(ctx *Context, node *shimast.Node) {
  call := node.AsCallExpression()
  method := cypressCallMethod(call)
  if !cypressForceActionMethods[method] || !hasCypressRoot(call.Expression) {
    return
  }
  if callHasForceTrueOption(call) {
    ctx.Report(node, "Do not use force: true with Cypress action commands.")
  }
}

func (cypressNoPause) Name() string { return "cypress/no-pause" }
func (cypressNoPause) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindCallExpression}
}
func (cypressNoPause) Check(ctx *Context, node *shimast.Node) {
  call := node.AsCallExpression()
  if cypressCallMethod(call) == "pause" && hasCypressRoot(call.Expression) {
    ctx.Report(node, "Do not leave cy.pause() in committed Cypress specs.")
  }
}

func (cypressNoDebug) Name() string { return "cypress/no-debug" }
func (cypressNoDebug) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindCallExpression}
}
func (cypressNoDebug) Check(ctx *Context, node *shimast.Node) {
  call := node.AsCallExpression()
  if cypressCallMethod(call) == "debug" && hasCypressRoot(call.Expression) {
    ctx.Report(node, "Do not leave cy.debug() in committed Cypress specs.")
  }
}

func (cypressUnsafeToChainCommand) Name() string { return "cypress/unsafe-to-chain-command" }
func (cypressUnsafeToChainCommand) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindCallExpression}
}
func (cypressUnsafeToChainCommand) Check(ctx *Context, node *shimast.Node) {
  call := node.AsCallExpression()
  method := cypressCallMethod(call)
  if method == "" || !hasCypressRoot(call.Expression) || !isUnsafeCypressAction(ctx, method) {
    return
  }
  if cypressCallIsChainedIntoAnotherCommand(node) {
    ctx.Report(node, "Do not chain further commands after this Cypress action.")
  }
}

func (cypressAssertionBeforeScreenshot) Name() string {
  return "cypress/assertion-before-screenshot"
}
func (cypressAssertionBeforeScreenshot) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindSourceFile}
}
func (cypressAssertionBeforeScreenshot) Check(ctx *Context, node *shimast.Node) {
  walkDescendants(node, func(child *shimast.Node) {
    if child == nil || child.Kind != shimast.KindCallExpression {
      return
    }
    call := child.AsCallExpression()
    if call == nil || cypressCallMethod(call) != "screenshot" || !hasCypressRoot(call.Expression) {
      return
    }
    if cypressScreenshotHasAssertion(child, call) {
      return
    }
    ctx.Report(child, "Add a Cypress assertion before taking a screenshot.")
  })
}

func cypressScreenshotHasAssertion(node *shimast.Node, call *shimast.CallExpression) bool {
  if call != nil && previousChainHasAnyMethod(call.Expression, "should", "and") {
    return true
  }
  previous := cypressPreviousStatement(cypressContainingStatement(node))
  return cypressStatementEndsWithAssertion(previous)
}

func cypressContainingStatement(node *shimast.Node) *shimast.Node {
  for current := node; current != nil; current = current.Parent {
    if current.Parent == nil {
      continue
    }
    for _, stmt := range parentStatements(current.Parent) {
      if stmt == current {
        return current
      }
    }
  }
  return nil
}

func cypressPreviousStatement(stmt *shimast.Node) *shimast.Node {
  if stmt == nil || stmt.Parent == nil {
    return nil
  }
  siblings := parentStatements(stmt.Parent)
  for i, sibling := range siblings {
    if sibling == stmt && i > 0 {
      return siblings[i-1]
    }
  }
  return nil
}

func cypressStatementEndsWithAssertion(stmt *shimast.Node) bool {
  if stmt == nil || stmt.Kind != shimast.KindExpressionStatement {
    return false
  }
  exprStmt := stmt.AsExpressionStatement()
  if exprStmt == nil {
    return false
  }
  return cypressExpressionEndsWithAssertion(exprStmt.Expression)
}

func cypressExpressionEndsWithAssertion(node *shimast.Node) bool {
  node = stripParens(node)
  if node == nil || node.Kind != shimast.KindCallExpression {
    return false
  }
  call := node.AsCallExpression()
  if call == nil {
    return false
  }
  method := cypressCallMethod(call)
  return (method == "should" || method == "and") && hasCypressRoot(call.Expression)
}

func (cypressNoAsyncTests) Name() string { return "cypress/no-async-tests" }
func (cypressNoAsyncTests) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindCallExpression}
}
func (cypressNoAsyncTests) Check(ctx *Context, node *shimast.Node) {
  call := node.AsCallExpression()
  if !isMochaCall(call, "it", "specify", "test") {
    return
  }
  if callback := lastFunctionArgument(call); callback != nil && hasAsyncModifier(callback) {
    ctx.Report(callback, "Do not use async Cypress test callbacks.")
  }
}

func (cypressNoAsyncBefore) Name() string { return "cypress/no-async-before" }
func (cypressNoAsyncBefore) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindCallExpression}
}
func (cypressNoAsyncBefore) Check(ctx *Context, node *shimast.Node) {
  call := node.AsCallExpression()
  if !isMochaCall(call, "before", "beforeEach") {
    return
  }
  if callback := lastFunctionArgument(call); callback != nil && hasAsyncModifier(callback) {
    ctx.Report(callback, "Do not use async Cypress before hooks.")
  }
}

func (cypressNoAnd) Name() string { return "cypress/no-and" }
func (cypressNoAnd) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindCallExpression}
}
func (cypressNoAnd) Check(ctx *Context, node *shimast.Node) {
  call := node.AsCallExpression()
  if cypressCallMethod(call) != "and" || !hasCypressRoot(call.Expression) {
    return
  }
  previous := previousCypressMethod(call.Expression)
  if previous == "should" || previous == "and" || previous == "contains" {
    return
  }
  ctx.Report(node, "Use .should() to start Cypress assertion chains.")
}

func (cypressNoChainedGet) Name() string { return "cypress/no-chained-get" }
func (cypressNoChainedGet) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindCallExpression}
}
func (cypressNoChainedGet) Check(ctx *Context, node *shimast.Node) {
  call := node.AsCallExpression()
  if cypressCallMethod(call) != "get" || !hasCypressRoot(call.Expression) {
    return
  }
  if previousChainHasMethod(call.Expression, "get") {
    ctx.Report(node, "Do not chain cy.get(); use .find() from the previous subject.")
  }
}

func (cypressNoXpath) Name() string { return "cypress/no-xpath" }
func (cypressNoXpath) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindCallExpression}
}
func (cypressNoXpath) Check(ctx *Context, node *shimast.Node) {
  call := node.AsCallExpression()
  if cypressCallMethod(call) == "xpath" && hasCypressRoot(call.Expression) {
    ctx.Report(node, "Do not use cy.xpath(); migrate to supported selectors.")
  }
}

func (cypressRequireDataSelectors) Name() string { return "cypress/require-data-selectors" }
func (cypressRequireDataSelectors) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindSourceFile}
}
func (cypressRequireDataSelectors) Check(ctx *Context, node *shimast.Node) {
  constants := cypressStringConstants(node)
  walkDescendants(node, func(child *shimast.Node) {
    if child == nil || child.Kind != shimast.KindCallExpression {
      return
    }
    call := child.AsCallExpression()
    if cypressCallMethod(call) != "get" || !hasCypressRoot(call.Expression) {
      return
    }
    if call.Arguments == nil || len(call.Arguments.Nodes) == 0 {
      return
    }
    arg := stripParens(call.Arguments.Nodes[0])
    verdict, ok := cypressSelectorUsesDataAttribute(ctx.File, arg, constants)
    if ok && !verdict {
      ctx.Report(arg, "Use data-* attribute selectors with cy.get().")
    }
  })
}

func cypressCallMethod(call *shimast.CallExpression) string {
  if call == nil || call.Expression == nil || call.Expression.Kind != shimast.KindPropertyAccessExpression {
    return ""
  }
  access := call.Expression.AsPropertyAccessExpression()
  if access == nil {
    return ""
  }
  return identifierText(access.Name())
}

func hasCypressRoot(node *shimast.Node) bool {
  node = stripParens(node)
  if node == nil {
    return false
  }
  switch node.Kind {
  case shimast.KindIdentifier:
    return identifierText(node) == "cy"
  case shimast.KindPropertyAccessExpression:
    access := node.AsPropertyAccessExpression()
    return access != nil && hasCypressRoot(access.Expression)
  case shimast.KindCallExpression:
    call := node.AsCallExpression()
    return call != nil && hasCypressRoot(call.Expression)
  }
  return false
}

func isCypressChain(node *shimast.Node) bool {
  node = stripParens(node)
  if node == nil || node.Kind != shimast.KindCallExpression {
    return false
  }
  call := node.AsCallExpression()
  return call != nil && hasCypressRoot(call.Expression)
}

var cypressForceActionMethods = map[string]bool{
  "check":      true,
  "click":      true,
  "dblclick":   true,
  "focus":      true,
  "rightclick": true,
  "select":     true,
  "trigger":    true,
  "type":       true,
}

var cypressUnsafeActionMethods = map[string]bool{
  "blur":           true,
  "check":          true,
  "clear":          true,
  "click":          true,
  "dblclick":       true,
  "each":           true,
  "focus":          true,
  "rightclick":     true,
  "scrollIntoView": true,
  "scrollTo":       true,
  "select":         true,
  "selectFile":     true,
  "spread":         true,
  "submit":         true,
  "trigger":        true,
  "type":           true,
  "uncheck":        true,
  "within":         true,
}

func isUnsafeCypressAction(ctx *Context, method string) bool {
  if cypressUnsafeActionMethods[method] {
    return true
  }
  var options struct {
    Methods []string `json:"methods"`
  }
  if ctx != nil && len(ctx.Options) > 0 {
    _ = json.Unmarshal(ctx.Options, &options)
  }
  for _, extra := range options.Methods {
    if method == extra {
      return true
    }
  }
  return false
}

func callHasForceTrueOption(call *shimast.CallExpression) bool {
  if call == nil || call.Arguments == nil {
    return false
  }
  for _, arg := range call.Arguments.Nodes {
    if objectLiteralHasBooleanProperty(stripParens(arg), "force", true) {
      return true
    }
  }
  return false
}

func objectLiteralHasBooleanProperty(node *shimast.Node, property string, value bool) bool {
  if node == nil || node.Kind != shimast.KindObjectLiteralExpression {
    return false
  }
  obj := node.AsObjectLiteralExpression()
  if obj == nil || obj.Properties == nil {
    return false
  }
  for _, prop := range obj.Properties.Nodes {
    if prop == nil || prop.Kind != shimast.KindPropertyAssignment {
      continue
    }
    assignment := prop.AsPropertyAssignment()
    if assignment == nil || staticPropertyKey(nil, assignment.Name()) != property {
      continue
    }
    if actual, ok := isLiteralBoolean(stripParens(assignment.Initializer)); ok && actual == value {
      return true
    }
  }
  return false
}

func cypressCallIsChainedIntoAnotherCommand(node *shimast.Node) bool {
  parent := node.Parent
  if parent == nil || parent.Kind != shimast.KindPropertyAccessExpression {
    return false
  }
  grand := parent.Parent
  return grand != nil && grand.Kind == shimast.KindCallExpression
}

func isMochaCall(call *shimast.CallExpression, names ...string) bool {
  if call == nil || call.Expression == nil {
    return false
  }
  callee := mochaRootName(call.Expression)
  for _, name := range names {
    if callee == name {
      return true
    }
  }
  return false
}

func mochaRootName(node *shimast.Node) string {
  node = stripParens(node)
  if node == nil {
    return ""
  }
  switch node.Kind {
  case shimast.KindIdentifier:
    return identifierText(node)
  case shimast.KindPropertyAccessExpression:
    access := node.AsPropertyAccessExpression()
    if access == nil {
      return ""
    }
    return mochaRootName(access.Expression)
  }
  return ""
}

func lastFunctionArgument(call *shimast.CallExpression) *shimast.Node {
  if call == nil || call.Arguments == nil {
    return nil
  }
  for i := len(call.Arguments.Nodes) - 1; i >= 0; i-- {
    arg := call.Arguments.Nodes[i]
    if isFunctionLikeKind(arg) {
      return arg
    }
  }
  return nil
}

func previousCypressMethod(node *shimast.Node) string {
  node = stripParens(node)
  if node == nil || node.Kind != shimast.KindPropertyAccessExpression {
    return ""
  }
  access := node.AsPropertyAccessExpression()
  if access == nil {
    return ""
  }
  receiver := stripParens(access.Expression)
  if receiver == nil || receiver.Kind != shimast.KindCallExpression {
    return ""
  }
  return cypressCallMethod(receiver.AsCallExpression())
}

func previousChainHasMethod(node *shimast.Node, method string) bool {
  return previousChainHasAnyMethod(node, method)
}

func previousChainHasAnyMethod(node *shimast.Node, methods ...string) bool {
  node = stripParens(node)
  for node != nil {
    switch node.Kind {
    case shimast.KindCallExpression:
      call := node.AsCallExpression()
      if call == nil {
        return false
      }
      current := cypressCallMethod(call)
      for _, method := range methods {
        if current == method {
          return true
        }
      }
      node = stripParens(call.Expression)
    case shimast.KindPropertyAccessExpression:
      access := node.AsPropertyAccessExpression()
      if access == nil {
        return false
      }
      node = stripParens(access.Expression)
    case shimast.KindIdentifier:
      return false
    default:
      return false
    }
  }
  return false
}

func cypressStringConstants(node *shimast.Node) map[string]string {
  constants := map[string]string{}
  walkDescendants(node, func(child *shimast.Node) {
    if child == nil || child.Kind != shimast.KindVariableDeclaration {
      return
    }
    decl := child.AsVariableDeclaration()
    if decl == nil || decl.Initializer == nil || child.Parent == nil || child.Parent.Kind != shimast.KindVariableDeclarationList {
      return
    }
    if !shimast.IsConst(child.Parent) {
      return
    }
    name := identifierText(decl.Name())
    if name == "" {
      return
    }
    if value, ok := cypressStaticSelectorText(nil, stripParens(decl.Initializer), constants); ok {
      constants[name] = value
    }
  })
  return constants
}

func cypressSelectorUsesDataAttribute(file *shimast.SourceFile, node *shimast.Node, constants map[string]string) (bool, bool) {
  value, ok := cypressStaticSelectorText(file, node, constants)
  if !ok {
    return false, false
  }
  return cypressSelectorStringUsesDataAttribute(value), true
}

func cypressStaticSelectorText(file *shimast.SourceFile, node *shimast.Node, constants map[string]string) (string, bool) {
  node = stripParens(node)
  if node == nil {
    return "", false
  }
  switch node.Kind {
  case shimast.KindStringLiteral, shimast.KindNoSubstitutionTemplateLiteral:
    return stringLiteralText(node), true
  case shimast.KindIdentifier:
    value, ok := constants[identifierText(node)]
    return value, ok
  case shimast.KindConditionalExpression:
    cond := node.AsConditionalExpression()
    if cond == nil {
      return "", false
    }
    left, leftOK := cypressStaticSelectorText(file, cond.WhenTrue, constants)
    right, rightOK := cypressStaticSelectorText(file, cond.WhenFalse, constants)
    if !leftOK || !rightOK {
      return "", false
    }
    if cypressSelectorStringUsesDataAttribute(left) && cypressSelectorStringUsesDataAttribute(right) {
      return "[data-*]", true
    }
    return ".invalid", true
  case shimast.KindTemplateExpression:
    text := strings.TrimSpace(nodeText(file, node))
    if strings.HasPrefix(text, "`") && strings.HasSuffix(text, "`") {
      return strings.Trim(text, "`"), true
    }
  }
  return "", false
}

func cypressSelectorStringUsesDataAttribute(selector string) bool {
  selector = strings.TrimSpace(selector)
  if strings.HasPrefix(selector, "@") {
    return true
  }
  lower := strings.ToLower(selector)
  return strings.HasPrefix(lower, "[data-") && strings.Contains(lower, "]")
}

func init() {
  Register(cypressNoAssigningReturnValues{})
  Register(cypressNoUnnecessaryWaiting{})
  Register(cypressNoForce{})
  Register(cypressNoPause{})
  Register(cypressNoDebug{})
  Register(cypressUnsafeToChainCommand{})
  Register(cypressAssertionBeforeScreenshot{})
  Register(cypressNoAsyncTests{})
  Register(cypressNoAsyncBefore{})
  Register(cypressNoAnd{})
  Register(cypressNoChainedGet{})
  Register(cypressNoXpath{})
  Register(cypressRequireDataSelectors{})
}
