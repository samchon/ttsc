package linthost

import (
  "fmt"
  "strings"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

type playwrightRule struct {
  name string
  run  func(*Context, *shimast.Node)
}

func (r playwrightRule) Name() string           { return "playwright/" + r.name }
func (r playwrightRule) Visits() []shimast.Kind { return []shimast.Kind{shimast.KindSourceFile} }
func (r playwrightRule) Check(ctx *Context, node *shimast.Node) {
  if r.run != nil {
    r.run(ctx, node)
  }
}

func playwrightCallChain(node *shimast.Node) []string {
  node = stripParens(node)
  if node == nil {
    return nil
  }
  if name := identifierText(node); name != "" {
    return []string{name}
  }
  switch node.Kind {
  case shimast.KindPropertyAccessExpression:
    access := node.AsPropertyAccessExpression()
    if access == nil {
      return nil
    }
    chain := playwrightCallChain(access.Expression)
    if len(chain) == 0 {
      return nil
    }
    return append(chain, identifierText(access.Name()))
  case shimast.KindCallExpression:
    call := node.AsCallExpression()
    if call == nil {
      return nil
    }
    return playwrightCallChain(call.Expression)
  }
  return nil
}

func playwrightCalledName(call *shimast.CallExpression) string {
  chain := playwrightCallChain(call.Expression)
  if len(chain) == 0 {
    return ""
  }
  return chain[len(chain)-1]
}

func playwrightChainText(chain []string) string {
  return strings.Join(chain, ".")
}

func isPlaywrightTestCall(chain []string) bool {
  if len(chain) == 0 || chain[0] != "test" {
    return false
  }
  last := chain[len(chain)-1]
  switch last {
  case "test", "only", "skip", "fixme", "fail", "slow":
    return true
  }
  return len(chain) == 1
}

func isPlaywrightDescribeCall(chain []string) bool {
  return len(chain) >= 2 && chain[0] == "test" && chain[1] == "describe"
}

func isPlaywrightHookName(name string) bool {
  switch name {
  case "beforeEach", "afterEach", "beforeAll", "afterAll":
    return true
  }
  return false
}

func isPlaywrightHookCall(chain []string) bool {
  return len(chain) >= 2 && chain[0] == "test" && isPlaywrightHookName(chain[len(chain)-1])
}

func isExpectCallNode(node *shimast.Node) bool {
  if node == nil || node.Kind != shimast.KindCallExpression {
    return false
  }
  call := node.AsCallExpression()
  return call != nil && playwrightCalledName(call) == "expect"
}

func callArgument(call *shimast.CallExpression, index int) *shimast.Node {
  if call == nil || call.Arguments == nil || index < 0 || index >= len(call.Arguments.Nodes) {
    return nil
  }
  return stripParens(call.Arguments.Nodes[index])
}

func objectPropertyNode(file *shimast.SourceFile, object *shimast.Node, key string) *shimast.Node {
  if object == nil || object.Kind != shimast.KindObjectLiteralExpression {
    return nil
  }
  obj := object.AsObjectLiteralExpression()
  if obj == nil || obj.Properties == nil {
    return nil
  }
  for _, prop := range obj.Properties.Nodes {
    if propertyKey(file, prop) == key {
      return prop
    }
  }
  return nil
}

func objectPropertyValue(file *shimast.SourceFile, object *shimast.Node, key string) *shimast.Node {
  prop := objectPropertyNode(file, object, key)
  if prop == nil || prop.Kind != shimast.KindPropertyAssignment {
    return nil
  }
  assignment := prop.AsPropertyAssignment()
  if assignment == nil {
    return nil
  }
  return stripParens(assignment.Initializer)
}

func isPlaywrightTrueLiteral(node *shimast.Node) bool {
  return node != nil && node.Kind == shimast.KindTrueKeyword
}

func isStringLiteralValue(node *shimast.Node, value string) bool {
  return stringLiteralText(stripParens(node)) == value
}

func hasAncestorBeforeFunction(node *shimast.Node, kinds ...shimast.Kind) bool {
  wanted := map[shimast.Kind]bool{}
  for _, kind := range kinds {
    wanted[kind] = true
  }
  for cur := node.Parent; cur != nil; cur = cur.Parent {
    if isFunctionLikeKind(cur) {
      return false
    }
    if wanted[cur.Kind] {
      return true
    }
  }
  return false
}

func nearestCallAncestor(node *shimast.Node, predicate func([]string) bool) *shimast.Node {
  for cur := node.Parent; cur != nil; cur = cur.Parent {
    if cur.Kind != shimast.KindCallExpression {
      continue
    }
    call := cur.AsCallExpression()
    if call != nil && predicate(playwrightCallChain(call.Expression)) {
      return cur
    }
  }
  return nil
}

func nearestTestLikeCall(node *shimast.Node) *shimast.Node {
  return nearestCallAncestor(node, func(chain []string) bool {
    return isPlaywrightTestCall(chain) || isPlaywrightDescribeCall(chain)
  })
}

func functionBodyContains(root *shimast.Node, predicate func(*shimast.Node) bool) bool {
  found := false
  walkDescendants(root, func(child *shimast.Node) {
    if found || child == root {
      return
    }
    if isFunctionLikeKind(child) {
      return
    }
    if predicate(child) {
      found = true
    }
  })
  return found
}

func playwrightCallbackArg(call *shimast.CallExpression) *shimast.Node {
  if call == nil || call.Arguments == nil {
    return nil
  }
  for _, arg := range call.Arguments.Nodes {
    arg = stripParens(arg)
    if arg != nil && isFunctionLikeKind(arg) {
      return arg
    }
  }
  return nil
}

func runPlaywrightFocusedTest(ctx *Context, root *shimast.Node) {
  walkDescendants(root, func(node *shimast.Node) {
    if node.Kind != shimast.KindCallExpression {
      return
    }
    call := node.AsCallExpression()
    chain := playwrightCallChain(call.Expression)
    if len(chain) > 1 && chain[len(chain)-1] == "only" && (isPlaywrightTestCall(chain) || isPlaywrightDescribeCall(chain)) {
      ctx.Report(node, "Unexpected focused Playwright test.")
    }
  })
}

func runPlaywrightSkippedTest(ctx *Context, root *shimast.Node) {
  walkDescendants(root, func(node *shimast.Node) {
    if node.Kind != shimast.KindCallExpression {
      return
    }
    call := node.AsCallExpression()
    chain := playwrightCallChain(call.Expression)
    if len(chain) > 1 && chain[len(chain)-1] == "skip" && (isPlaywrightTestCall(chain) || isPlaywrightDescribeCall(chain)) {
      ctx.Report(node, "Unexpected skipped Playwright test.")
    }
  })
}

func runPlaywrightNoPagePause(ctx *Context, root *shimast.Node) {
  reportMatchingCall(ctx, root, func(chain []string, _ *shimast.CallExpression) bool {
    return playwrightChainText(chain) == "page.pause"
  }, "Unexpected page.pause().")
}

func runPlaywrightNoWaitForTimeout(ctx *Context, root *shimast.Node) {
  reportMatchingCall(ctx, root, func(chain []string, _ *shimast.CallExpression) bool {
    return len(chain) >= 2 && chain[len(chain)-2] == "page" && chain[len(chain)-1] == "waitForTimeout"
  }, "Unexpected page.waitForTimeout().")
}

func runPlaywrightNoWaitForNavigation(ctx *Context, root *shimast.Node) {
  reportMatchingCall(ctx, root, func(chain []string, _ *shimast.CallExpression) bool {
    return len(chain) >= 2 && chain[len(chain)-2] == "page" && chain[len(chain)-1] == "waitForNavigation"
  }, "Unexpected page.waitForNavigation().")
}

func runPlaywrightNoWaitForSelector(ctx *Context, root *shimast.Node) {
  reportMatchingCall(ctx, root, func(chain []string, _ *shimast.CallExpression) bool {
    return len(chain) >= 2 && chain[len(chain)-2] == "page" && chain[len(chain)-1] == "waitForSelector"
  }, "Unexpected page.waitForSelector(). Use locators instead.")
}

func runPlaywrightNoEval(ctx *Context, root *shimast.Node) {
  reportMatchingCall(ctx, root, func(chain []string, _ *shimast.CallExpression) bool {
    if len(chain) < 2 || chain[len(chain)-2] != "page" {
      return false
    }
    last := chain[len(chain)-1]
    return last == "$eval" || last == "$$eval"
  }, "Unexpected page eval helper.")
}

func runPlaywrightNoElementHandle(ctx *Context, root *shimast.Node) {
  reportMatchingCall(ctx, root, func(chain []string, _ *shimast.CallExpression) bool {
    if len(chain) < 2 {
      return false
    }
    text := playwrightChainText(chain)
    return text == "page.$" || text == "page.$$" || strings.HasSuffix(text, ".elementHandle") || strings.HasSuffix(text, ".elementHandles")
  }, "Unexpected ElementHandle usage. Prefer locators.")
}

func runPlaywrightNoGetByTitle(ctx *Context, root *shimast.Node) {
  reportMatchingCall(ctx, root, func(chain []string, _ *shimast.CallExpression) bool {
    return len(chain) > 0 && chain[len(chain)-1] == "getByTitle"
  }, "Unexpected getByTitle().")
}

func runPlaywrightNoNthMethods(ctx *Context, root *shimast.Node) {
  reportMatchingCall(ctx, root, func(chain []string, _ *shimast.CallExpression) bool {
    if len(chain) == 0 {
      return false
    }
    switch chain[len(chain)-1] {
    case "first", "last", "nth":
      return true
    }
    return false
  }, "Unexpected positional locator method.")
}

func runPlaywrightNoHooks(ctx *Context, root *shimast.Node) {
  reportMatchingCall(ctx, root, func(chain []string, _ *shimast.CallExpression) bool {
    return isPlaywrightHookCall(chain)
  }, "Unexpected Playwright hook.")
}

func runPlaywrightNoSlowedTest(ctx *Context, root *shimast.Node) {
  reportMatchingCall(ctx, root, func(chain []string, _ *shimast.CallExpression) bool {
    return len(chain) > 1 && chain[0] == "test" && chain[len(chain)-1] == "slow"
  }, "Unexpected slowed Playwright test.")
}

func runPlaywrightNoForceOption(ctx *Context, root *shimast.Node) {
  walkDescendants(root, func(node *shimast.Node) {
    if node.Kind != shimast.KindCallExpression {
      return
    }
    call := node.AsCallExpression()
    if call == nil {
      return
    }
    chain := playwrightCallChain(call.Expression)
    if !isPlaywrightForceOptionMethod(chain) {
      return
    }
    lastArg := -1
    if call.Arguments != nil {
      lastArg = len(call.Arguments.Nodes) - 1
    }
    options := callArgument(call, lastArg)
    prop := objectPropertyNode(ctx.File, options, "force")
    if prop != nil && isPlaywrightTrueLiteral(objectPropertyValue(ctx.File, options, "force")) {
      ctx.Report(prop, "Unexpected Playwright force option.")
    }
  })
}

func isPlaywrightForceOptionMethod(chain []string) bool {
  if len(chain) < 2 {
    return false
  }
  switch chain[len(chain)-1] {
  case "check", "clear", "click", "dblclick", "dragAndDrop", "dragTo", "fill", "hover", "selectOption", "selectText", "setChecked", "tap", "uncheck":
    return true
  }
  return false
}

func runPlaywrightNoNetworkidle(ctx *Context, root *shimast.Node) {
  walkDescendants(root, func(node *shimast.Node) {
    if node.Kind != shimast.KindCallExpression {
      return
    }
    call := node.AsCallExpression()
    if call == nil {
      return
    }
    chain := playwrightCallChain(call.Expression)
    if !isPlaywrightNetworkidleMethod(chain) {
      return
    }
    method := chain[len(chain)-1]
    if method == "waitForLoadState" && isStringLiteralValue(callArgument(call, 0), "networkidle") {
      ctx.Report(callArgument(call, 0), "Unexpected networkidle load state.")
      return
    }
    options := playwrightWaitUntilOptionsArgument(call, method)
    value := objectPropertyValue(ctx.File, options, "waitUntil")
    if isStringLiteralValue(value, "networkidle") {
      ctx.Report(value, "Unexpected networkidle waitUntil option.")
    }
  })
}

func isPlaywrightNetworkidleMethod(chain []string) bool {
  if len(chain) < 2 {
    return false
  }
  switch chain[len(chain)-1] {
  case "goBack", "goForward", "goto", "reload", "setContent", "waitForLoadState", "waitForNavigation", "waitForURL":
    return true
  }
  return false
}

func playwrightWaitUntilOptionsArgument(call *shimast.CallExpression, method string) *shimast.Node {
  switch method {
  case "goBack", "goForward", "reload", "waitForNavigation":
    return callArgument(call, 0)
  case "goto", "setContent", "waitForURL":
    return callArgument(call, 1)
  }
  return nil
}

func runPlaywrightExpectExpect(ctx *Context, root *shimast.Node) {
  walkDescendants(root, func(node *shimast.Node) {
    if node.Kind != shimast.KindCallExpression {
      return
    }
    call := node.AsCallExpression()
    if !isPlaywrightTestCall(playwrightCallChain(call.Expression)) {
      return
    }
    callback := playwrightCallbackArg(call)
    if callback == nil {
      return
    }
    body := callback.Body()
    if body == nil {
      return
    }
    if !functionBodyContains(body, isExpectCallNode) {
      ctx.Report(node, "Playwright test has no assertion.")
    }
  })
}

func runPlaywrightNoConditionalExpect(ctx *Context, root *shimast.Node) {
  walkDescendants(root, func(node *shimast.Node) {
    if !isExpectCallNode(node) || nearestTestLikeCall(node) == nil {
      return
    }
    if hasAncestorBeforeFunction(node, shimast.KindIfStatement, shimast.KindConditionalExpression, shimast.KindSwitchStatement) {
      ctx.Report(node, "Avoid conditional Playwright expect calls.")
    }
  })
}

func runPlaywrightNoConditionalInTest(ctx *Context, root *shimast.Node) {
  walkDescendants(root, func(node *shimast.Node) {
    switch node.Kind {
    case shimast.KindIfStatement, shimast.KindConditionalExpression, shimast.KindSwitchStatement:
    default:
      return
    }
    if nearestTestLikeCall(node) != nil {
      ctx.Report(node, "Avoid conditional logic in Playwright tests.")
    }
  })
}

func runPlaywrightNoDuplicateHooks(ctx *Context, root *shimast.Node) {
  seen := map[string]*shimast.Node{}
  walkDescendants(root, func(node *shimast.Node) {
    if node.Kind != shimast.KindCallExpression {
      return
    }
    call := node.AsCallExpression()
    chain := playwrightCallChain(call.Expression)
    if !isPlaywrightHookCall(chain) {
      return
    }
    name := chain[len(chain)-1]
    if first := seen[name]; first != nil {
      ctx.Report(node, "Duplicate Playwright "+name+" hook.")
    } else {
      seen[name] = node
    }
  })
}

func runPlaywrightNoDuplicateSlow(ctx *Context, root *shimast.Node) {
  walkDescendants(root, func(node *shimast.Node) {
    if node.Kind != shimast.KindCallExpression {
      return
    }
    call := node.AsCallExpression()
    if !isPlaywrightTestCall(playwrightCallChain(call.Expression)) {
      return
    }
    callback := playwrightCallbackArg(call)
    if callback == nil || callback.Body() == nil {
      return
    }
    count := 0
    walkDescendants(callback.Body(), func(child *shimast.Node) {
      if child.Kind != shimast.KindCallExpression {
        return
      }
      c := child.AsCallExpression()
      if c == nil {
        return
      }
      chain := playwrightCallChain(c.Expression)
      if len(chain) > 1 && chain[0] == "test" && chain[len(chain)-1] == "slow" {
        count++
        if count > 1 {
          ctx.Report(child, "Duplicate test.slow() call.")
        }
      }
    })
  })
}

func runPlaywrightNoNestedStep(ctx *Context, root *shimast.Node) {
  walkDescendants(root, func(node *shimast.Node) {
    if node.Kind != shimast.KindCallExpression {
      return
    }
    call := node.AsCallExpression()
    if call == nil || playwrightChainText(playwrightCallChain(call.Expression)) != "test.step" {
      return
    }
    if nearestCallAncestor(node, func(chain []string) bool { return playwrightChainText(chain) == "test.step" }) != nil {
      ctx.Report(node, "Unexpected nested test.step().")
    }
  })
}

func runPlaywrightNoStandaloneExpect(ctx *Context, root *shimast.Node) {
  walkDescendants(root, func(node *shimast.Node) {
    if isExpectCallNode(node) && nearestTestLikeCall(node) == nil {
      ctx.Report(node, "Unexpected Playwright expect outside a test block.")
    }
  })
}

func runPlaywrightPreferLocator(ctx *Context, root *shimast.Node) {
  methods := map[string]bool{
    "click": true, "dblclick": true, "fill": true, "check": true, "uncheck": true,
    "hover": true, "press": true, "selectOption": true, "setInputFiles": true,
    "textContent": true, "innerText": true, "innerHTML": true, "isVisible": true,
  }
  reportMatchingCall(ctx, root, func(chain []string, _ *shimast.CallExpression) bool {
    return len(chain) >= 2 && chain[len(chain)-2] == "page" && methods[chain[len(chain)-1]]
  }, "Prefer locator-based Playwright APIs.")
}

func runPlaywrightPreferWebFirstAssertions(ctx *Context, root *shimast.Node) {
  walkDescendants(root, func(node *shimast.Node) {
    if node.Kind != shimast.KindCallExpression {
      return
    }
    call := node.AsCallExpression()
    if call == nil {
      return
    }
    chain := playwrightCallChain(call.Expression)
    if len(chain) == 0 {
      return
    }
    matcher := chain[len(chain)-1]
    if matcher != "toBe" && matcher != "toEqual" {
      return
    }
    expectCall := expectCallFromMatcher(call.Expression)
    if expectCall == nil {
      return
    }
    arg := callArgument(expectCall, 0)
    if arg == nil || arg.Kind != shimast.KindAwaitExpression {
      return
    }
    awaited := arg.AsAwaitExpression()
    if awaited == nil {
      return
    }
    awaitedExpr := stripParens(awaited.Expression)
    if awaitedExpr == nil || awaitedExpr.Kind != shimast.KindCallExpression {
      return
    }
    awaitedCall := awaitedExpr.AsCallExpression()
    if awaitedCall == nil {
      return
    }
    awaitedChain := playwrightCallChain(awaitedCall.Expression)
    if len(awaitedChain) == 0 {
      return
    }
    switch awaitedChain[len(awaitedChain)-1] {
    case "isVisible", "isHidden", "isEnabled", "isDisabled", "isChecked", "textContent", "innerText":
      ctx.Report(node, "Prefer Playwright web-first assertions.")
    }
  })
}

func expectCallFromMatcher(expr *shimast.Node) *shimast.CallExpression {
  expr = stripParens(expr)
  if expr == nil || expr.Kind != shimast.KindPropertyAccessExpression {
    return nil
  }
  access := expr.AsPropertyAccessExpression()
  if access == nil {
    return nil
  }
  receiver := stripParens(access.Expression)
  if receiver == nil || receiver.Kind != shimast.KindCallExpression {
    return nil
  }
  call := receiver.AsCallExpression()
  if call != nil && playwrightCalledName(call) == "expect" {
    return call
  }
  return nil
}

func runPlaywrightPreferToHaveCount(ctx *Context, root *shimast.Node) {
  runExpectAwaitedMethodMatcher(ctx, root, "count", "toBe", "Prefer toHaveCount().")
}

func runPlaywrightPreferToHaveLength(ctx *Context, root *shimast.Node) {
  runExpectAwaitedMethodMatcher(ctx, root, "length", "toBe", "Prefer toHaveLength().")
}

func runExpectAwaitedMethodMatcher(ctx *Context, root *shimast.Node, method, matcher, message string) {
  walkDescendants(root, func(node *shimast.Node) {
    if node.Kind != shimast.KindCallExpression {
      return
    }
    call := node.AsCallExpression()
    if call == nil {
      return
    }
    chain := playwrightCallChain(call.Expression)
    if len(chain) == 0 || chain[len(chain)-1] != matcher {
      return
    }
    expectCall := expectCallFromMatcher(call.Expression)
    if expectCall == nil {
      return
    }
    arg := callArgument(expectCall, 0)
    if arg == nil || arg.Kind != shimast.KindAwaitExpression {
      return
    }
    awaited := arg.AsAwaitExpression()
    if awaited == nil {
      return
    }
    awaitedExpr := stripParens(awaited.Expression)
    if awaitedExpr == nil || awaitedExpr.Kind != shimast.KindCallExpression {
      return
    }
    awaitedCall := awaitedExpr.AsCallExpression()
    if awaitedCall == nil {
      return
    }
    awaitedChain := playwrightCallChain(awaitedCall.Expression)
    if len(awaitedChain) > 0 && awaitedChain[len(awaitedChain)-1] == method {
      ctx.Report(node, message)
    }
  })
}

func runPlaywrightValidExpect(ctx *Context, root *shimast.Node) {
  walkDescendants(root, func(node *shimast.Node) {
    if node.Kind != shimast.KindCallExpression {
      return
    }
    call := node.AsCallExpression()
    if call == nil || playwrightCalledName(call) != "expect" {
      return
    }
    argc := 0
    if call.Arguments != nil {
      argc = len(call.Arguments.Nodes)
    }
    if argc != 1 {
      ctx.Report(node, "Expect must have exactly one argument.")
    }
  })
}

func runPlaywrightValidDescribeCallback(ctx *Context, root *shimast.Node) {
  walkDescendants(root, func(node *shimast.Node) {
    if node.Kind != shimast.KindCallExpression {
      return
    }
    call := node.AsCallExpression()
    if call == nil || !isPlaywrightDescribeCall(playwrightCallChain(call.Expression)) {
      return
    }
    callback := playwrightCallbackArg(call)
    if callback == nil {
      ctx.Report(node, "Playwright describe must have a callback.")
      return
    }
    if hasAsyncModifier(callback) {
      ctx.Report(callback, "Playwright describe callback must not be async.")
    }
  })
}

func runPlaywrightValidTitle(ctx *Context, root *shimast.Node) {
  walkDescendants(root, func(node *shimast.Node) {
    if node.Kind != shimast.KindCallExpression {
      return
    }
    call := node.AsCallExpression()
    if call == nil {
      return
    }
    chain := playwrightCallChain(call.Expression)
    if !isPlaywrightTestCall(chain) && !isPlaywrightDescribeCall(chain) {
      return
    }
    title := callArgument(call, 0)
    if title == nil || stringLiteralText(title) == "" {
      ctx.Report(node, "Playwright test title must be a non-empty string.")
    }
  })
}

func runPlaywrightRequireToThrowMessage(ctx *Context, root *shimast.Node) {
  reportMatchingCall(ctx, root, func(chain []string, call *shimast.CallExpression) bool {
    if len(chain) == 0 || chain[len(chain)-1] != "toThrow" {
      return false
    }
    return call.Arguments == nil || len(call.Arguments.Nodes) == 0
  }, "Add an expected message to toThrow().")
}

func runPlaywrightRequireToPassTimeout(ctx *Context, root *shimast.Node) {
  reportMatchingCall(ctx, root, func(chain []string, call *shimast.CallExpression) bool {
    if len(chain) == 0 || chain[len(chain)-1] != "toPass" {
      return false
    }
    options := callArgument(call, 0)
    return objectPropertyValue(ctx.File, options, "timeout") == nil
  }, "Add a timeout option to toPass().")
}

func reportMatchingCall(ctx *Context, root *shimast.Node, match func([]string, *shimast.CallExpression) bool, message string) {
  walkDescendants(root, func(node *shimast.Node) {
    if node.Kind != shimast.KindCallExpression {
      return
    }
    call := node.AsCallExpression()
    if call != nil && match(playwrightCallChain(call.Expression), call) {
      ctx.Report(node, message)
    }
  })
}

func runPlaywrightMaxExpects(ctx *Context, root *shimast.Node) {
  walkDescendants(root, func(node *shimast.Node) {
    if node.Kind != shimast.KindCallExpression {
      return
    }
    call := node.AsCallExpression()
    if call == nil || !isPlaywrightTestCall(playwrightCallChain(call.Expression)) {
      return
    }
    callback := playwrightCallbackArg(call)
    if callback == nil || callback.Body() == nil {
      return
    }
    count := 0
    walkDescendants(callback.Body(), func(child *shimast.Node) {
      if isExpectCallNode(child) {
        count++
      }
    })
    if count > 5 {
      ctx.Report(node, fmt.Sprintf("Playwright test has too many assertions (%d > 5).", count))
    }
  })
}

func init() {
  Register(playwrightRule{name: "expect-expect", run: runPlaywrightExpectExpect})
  Register(playwrightRule{name: "max-expects", run: runPlaywrightMaxExpects})
  Register(playwrightRule{name: "no-conditional-expect", run: runPlaywrightNoConditionalExpect})
  Register(playwrightRule{name: "no-conditional-in-test", run: runPlaywrightNoConditionalInTest})
  Register(playwrightRule{name: "no-duplicate-hooks", run: runPlaywrightNoDuplicateHooks})
  Register(playwrightRule{name: "no-duplicate-slow", run: runPlaywrightNoDuplicateSlow})
  Register(playwrightRule{name: "no-element-handle", run: runPlaywrightNoElementHandle})
  Register(playwrightRule{name: "no-eval", run: runPlaywrightNoEval})
  Register(playwrightRule{name: "no-focused-test", run: runPlaywrightFocusedTest})
  Register(playwrightRule{name: "no-force-option", run: runPlaywrightNoForceOption})
  Register(playwrightRule{name: "no-get-by-title", run: runPlaywrightNoGetByTitle})
  Register(playwrightRule{name: "no-hooks", run: runPlaywrightNoHooks})
  Register(playwrightRule{name: "no-nested-step", run: runPlaywrightNoNestedStep})
  Register(playwrightRule{name: "no-networkidle", run: runPlaywrightNoNetworkidle})
  Register(playwrightRule{name: "no-nth-methods", run: runPlaywrightNoNthMethods})
  Register(playwrightRule{name: "no-page-pause", run: runPlaywrightNoPagePause})
  Register(playwrightRule{name: "no-skipped-test", run: runPlaywrightSkippedTest})
  Register(playwrightRule{name: "no-slowed-test", run: runPlaywrightNoSlowedTest})
  Register(playwrightRule{name: "no-standalone-expect", run: runPlaywrightNoStandaloneExpect})
  Register(playwrightRule{name: "no-wait-for-navigation", run: runPlaywrightNoWaitForNavigation})
  Register(playwrightRule{name: "no-wait-for-selector", run: runPlaywrightNoWaitForSelector})
  Register(playwrightRule{name: "no-wait-for-timeout", run: runPlaywrightNoWaitForTimeout})
  Register(playwrightRule{name: "prefer-locator", run: runPlaywrightPreferLocator})
  Register(playwrightRule{name: "prefer-to-have-count", run: runPlaywrightPreferToHaveCount})
  Register(playwrightRule{name: "prefer-to-have-length", run: runPlaywrightPreferToHaveLength})
  Register(playwrightRule{name: "prefer-web-first-assertions", run: runPlaywrightPreferWebFirstAssertions})
  Register(playwrightRule{name: "require-to-pass-timeout", run: runPlaywrightRequireToPassTimeout})
  Register(playwrightRule{name: "require-to-throw-message", run: runPlaywrightRequireToThrowMessage})
  Register(playwrightRule{name: "valid-describe-callback", run: runPlaywrightValidDescribeCallback})
  Register(playwrightRule{name: "valid-expect", run: runPlaywrightValidExpect})
  Register(playwrightRule{name: "valid-title", run: runPlaywrightValidTitle})
}
