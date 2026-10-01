package linthost

import (
  "fmt"
  "strings"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

type jestRule struct {
  name string
  run  func(*Context, *shimast.Node)
}

func (r jestRule) Name() string           { return "jest/" + r.name }
func (r jestRule) Visits() []shimast.Kind { return []shimast.Kind{shimast.KindSourceFile} }
func (r jestRule) Check(ctx *Context, node *shimast.Node) {
  if r.run != nil {
    r.run(ctx, node)
  }
}

func jestCallChain(node *shimast.Node) []string {
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
    chain := jestCallChain(access.Expression)
    if len(chain) == 0 {
      return nil
    }
    return append(chain, identifierText(access.Name()))
  case shimast.KindCallExpression:
    call := node.AsCallExpression()
    if call == nil {
      return nil
    }
    return jestCallChain(call.Expression)
  }
  return nil
}

func jestCalledName(call *shimast.CallExpression) string {
  chain := jestCallChain(call.Expression)
  if len(chain) == 0 {
    return ""
  }
  return chain[len(chain)-1]
}

func jestChainText(chain []string) string {
  return strings.Join(chain, ".")
}

func isJestTestCall(chain []string) bool {
  if len(chain) == 0 {
    return false
  }
  switch chain[0] {
  case "test", "it", "fit", "xit", "xtest":
    return true
  }
  return false
}

func isJestDescribeCall(chain []string) bool {
  if len(chain) == 0 {
    return false
  }
  switch chain[0] {
  case "describe", "fdescribe", "xdescribe":
    return true
  }
  return false
}

func isJestHookName(name string) bool {
  switch name {
  case "beforeAll", "beforeEach", "afterAll", "afterEach":
    return true
  }
  return false
}

func isJestHookCall(chain []string) bool {
  return len(chain) == 1 && isJestHookName(chain[0])
}

func isJestTestLikeCall(chain []string) bool {
  return isJestTestCall(chain) || isJestDescribeCall(chain)
}

func isJestExpectHead(chain []string) bool {
  return len(chain) > 0 && chain[0] == "expect"
}

func isJestExpectCallNode(node *shimast.Node) bool {
  if node == nil || node.Kind != shimast.KindCallExpression {
    return false
  }
  call := node.AsCallExpression()
  return call != nil && jestCalledName(call) == "expect"
}

func jestCallArgument(call *shimast.CallExpression, index int) *shimast.Node {
  if call == nil || call.Arguments == nil || index < 0 || index >= len(call.Arguments.Nodes) {
    return nil
  }
  return stripParens(call.Arguments.Nodes[index])
}

func jestCallbackArg(call *shimast.CallExpression) *shimast.Node {
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

func jestTitleArg(call *shimast.CallExpression) *shimast.Node {
  if call == nil || call.Arguments == nil {
    return nil
  }
  for _, arg := range call.Arguments.Nodes {
    arg = stripParens(arg)
    if arg == nil {
      continue
    }
    switch arg.Kind {
    case shimast.KindStringLiteral, shimast.KindNoSubstitutionTemplateLiteral:
      return arg
    }
  }
  return nil
}

func jestTitleText(call *shimast.CallExpression) (string, bool) {
  title := jestTitleArg(call)
  if title == nil {
    return "", false
  }
  return stringLiteralText(title), true
}

func walkJestBody(root *shimast.Node, visit func(*shimast.Node)) {
  if root == nil {
    return
  }
  var walk func(*shimast.Node)
  walk = func(node *shimast.Node) {
    if node == nil {
      return
    }
    if node != root && isFunctionLikeKind(node) {
      return
    }
    visit(node)
    node.ForEachChild(func(child *shimast.Node) bool {
      walk(child)
      return false
    })
  }
  walk(root)
}

func functionBodyContainsJestExpect(root *shimast.Node) bool {
  found := false
  walkJestBody(root, func(child *shimast.Node) {
    if found || child == root {
      return
    }
    if child.Kind != shimast.KindCallExpression {
      return
    }
    call := child.AsCallExpression()
    if call != nil && isJestExpectHead(jestCallChain(call.Expression)) {
      found = true
    }
  })
  return found
}

func forEachJestCall(root *shimast.Node, match func([]string) bool, visit func(*shimast.Node, *shimast.CallExpression, []string)) {
  walkDescendants(root, func(node *shimast.Node) {
    if node.Kind != shimast.KindCallExpression {
      return
    }
    call := node.AsCallExpression()
    if call == nil {
      return
    }
    chain := jestCallChain(call.Expression)
    if match(chain) {
      visit(node, call, chain)
    }
  })
}

func hasJestAncestorBefore(node, limit *shimast.Node, kinds ...shimast.Kind) bool {
  wanted := map[shimast.Kind]bool{}
  for _, kind := range kinds {
    wanted[kind] = true
  }
  for cur := node.Parent; cur != nil && cur != limit; cur = cur.Parent {
    if wanted[cur.Kind] {
      return true
    }
  }
  return false
}

func nearestJestDescribeAncestor(node *shimast.Node) *shimast.Node {
  for cur := node.Parent; cur != nil; cur = cur.Parent {
    if cur.Kind != shimast.KindCallExpression {
      continue
    }
    call := cur.AsCallExpression()
    if call != nil && isJestDescribeCall(jestCallChain(call.Expression)) {
      return cur
    }
  }
  return nil
}

func jestSuiteKey(node *shimast.Node) string {
  if node == nil {
    return "root"
  }
  return fmt.Sprintf("%d:%d", node.Pos(), node.End())
}

func jestCallContainingArgument(arg *shimast.Node) *shimast.CallExpression {
  for cur := arg.Parent; cur != nil; cur = cur.Parent {
    if cur.Kind != shimast.KindCallExpression {
      continue
    }
    call := cur.AsCallExpression()
    if call == nil || call.Arguments == nil {
      continue
    }
    for _, candidate := range call.Arguments.Nodes {
      if stripParens(candidate) == arg {
        return call
      }
    }
  }
  return nil
}

func nearestFunctionAncestor(node *shimast.Node) *shimast.Node {
  for cur := node.Parent; cur != nil; cur = cur.Parent {
    if isFunctionLikeKind(cur) {
      return cur
    }
  }
  return nil
}

func jestParameterName(param *shimast.Node) string {
  if param == nil || param.Kind != shimast.KindParameter {
    return ""
  }
  decl := param.AsParameterDeclaration()
  if decl == nil {
    return ""
  }
  return identifierText(decl.Name())
}

func isJestLengthAccess(node *shimast.Node) bool {
  node = stripParens(node)
  if node == nil || node.Kind != shimast.KindPropertyAccessExpression {
    return false
  }
  access := node.AsPropertyAccessExpression()
  return access != nil && identifierText(access.Name()) == "length"
}

func jestExpectCallFromMatcher(expr *shimast.Node) *shimast.CallExpression {
  expr = stripParens(expr)
  if expr == nil || expr.Kind != shimast.KindPropertyAccessExpression {
    return nil
  }
  access := expr.AsPropertyAccessExpression()
  if access == nil {
    return nil
  }
  receiver := stripParens(access.Expression)
  for receiver != nil && receiver.Kind == shimast.KindPropertyAccessExpression {
    inner := receiver.AsPropertyAccessExpression()
    if inner == nil {
      return nil
    }
    receiver = stripParens(inner.Expression)
  }
  if receiver == nil || receiver.Kind != shimast.KindCallExpression {
    return nil
  }
  call := receiver.AsCallExpression()
  if call != nil && jestCalledName(call) == "expect" {
    return call
  }
  return nil
}

func runJestFocusedTests(ctx *Context, root *shimast.Node) {
  forEachJestCall(root, func(chain []string) bool {
    return len(chain) > 0 && (chain[0] == "fit" || chain[0] == "fdescribe" || chain[len(chain)-1] == "only") && isJestTestLikeCall(chain)
  }, func(node *shimast.Node, _ *shimast.CallExpression, _ []string) {
    ctx.Report(node, "Unexpected focused Jest test.")
  })
}

func runJestDisabledTests(ctx *Context, root *shimast.Node) {
  forEachJestCall(root, func(chain []string) bool {
    return len(chain) > 0 && (chain[0] == "xit" || chain[0] == "xtest" || chain[0] == "xdescribe" || chain[len(chain)-1] == "skip") && isJestTestLikeCall(chain)
  }, func(node *shimast.Node, _ *shimast.CallExpression, _ []string) {
    ctx.Report(node, "Unexpected disabled Jest test.")
  })
}

func runJestNoTestPrefixes(ctx *Context, root *shimast.Node) {
  forEachJestCall(root, func(chain []string) bool {
    return len(chain) > 0 && (chain[0] == "fit" || chain[0] == "fdescribe" || chain[0] == "xit" || chain[0] == "xtest" || chain[0] == "xdescribe")
  }, func(node *shimast.Node, _ *shimast.CallExpression, _ []string) {
    ctx.Report(node, "Unexpected Jest test prefix alias.")
  })
}

func runJestExpectExpect(ctx *Context, root *shimast.Node) {
  forEachJestCall(root, isJestTestCall, func(node *shimast.Node, call *shimast.CallExpression, _ []string) {
    callback := jestCallbackArg(call)
    if callback == nil {
      return
    }
    body := callback.Body()
    if body == nil {
      return
    }
    if !functionBodyContainsJestExpect(body) {
      ctx.Report(node, "Jest test has no assertion.")
    }
  })
}

func runJestNoConditionalExpect(ctx *Context, root *shimast.Node) {
  forEachJestCall(root, isJestTestCall, func(_ *shimast.Node, call *shimast.CallExpression, _ []string) {
    callback := jestCallbackArg(call)
    if callback == nil || callback.Body() == nil {
      return
    }
    body := callback.Body()
    walkJestBody(body, func(child *shimast.Node) {
      if isJestExpectCallNode(child) && hasJestAncestorBefore(child, body, shimast.KindIfStatement, shimast.KindConditionalExpression, shimast.KindSwitchStatement) {
        ctx.Report(child, "Avoid conditional Jest expect calls.")
      }
    })
  })
}

func runJestNoConditionalInTest(ctx *Context, root *shimast.Node) {
  forEachJestCall(root, isJestTestCall, func(_ *shimast.Node, call *shimast.CallExpression, _ []string) {
    callback := jestCallbackArg(call)
    if callback == nil || callback.Body() == nil {
      return
    }
    walkJestBody(callback.Body(), func(child *shimast.Node) {
      switch child.Kind {
      case shimast.KindIfStatement, shimast.KindConditionalExpression, shimast.KindSwitchStatement:
        ctx.Report(child, "Avoid conditional logic in Jest tests.")
      }
    })
  })
}

func runJestNoStandaloneExpect(ctx *Context, root *shimast.Node) {
  walkDescendants(root, func(node *shimast.Node) {
    if !isJestExpectCallNode(node) {
      return
    }
    fn := nearestFunctionAncestor(node)
    if fn == nil {
      ctx.Report(node, "Unexpected Jest expect outside a test block.")
      return
    }
    owner := jestCallContainingArgument(fn)
    if owner == nil {
      return
    }
    if !isJestTestCall(jestCallChain(owner.Expression)) {
      ctx.Report(node, "Unexpected Jest expect outside a test block.")
    }
  })
}

func runJestNoDoneCallback(ctx *Context, root *shimast.Node) {
  forEachJestCall(root, func(chain []string) bool {
    return isJestTestCall(chain) || isJestHookCall(chain)
  }, func(_ *shimast.Node, call *shimast.CallExpression, _ []string) {
    callback := jestCallbackArg(call)
    if callback == nil {
      return
    }
    for _, param := range callback.Parameters() {
      if jestParameterName(param) == "done" {
        ctx.Report(param, "Avoid Jest done callbacks. Return a promise or use async/await.")
      }
    }
  })
}

func runJestNoExport(ctx *Context, root *shimast.Node) {
  walkDescendants(root, func(node *shimast.Node) {
    switch node.Kind {
    case shimast.KindExportDeclaration, shimast.KindExportAssignment:
      ctx.Report(node, "Unexpected export from Jest test file.")
    case shimast.KindVariableStatement, shimast.KindFunctionDeclaration, shimast.KindClassDeclaration, shimast.KindInterfaceDeclaration, shimast.KindTypeAliasDeclaration, shimast.KindEnumDeclaration:
      if hasModifier(node, shimast.KindExportKeyword) {
        ctx.Report(node, "Unexpected export from Jest test file.")
      }
    }
  })
}

func runJestNoIdenticalTitle(ctx *Context, root *shimast.Node) {
  seen := map[string]*shimast.Node{}
  forEachJestCall(root, isJestTestLikeCall, func(node *shimast.Node, call *shimast.CallExpression, chain []string) {
    title, ok := jestTitleText(call)
    if !ok || title == "" {
      return
    }
    group := "test"
    if isJestDescribeCall(chain) {
      group = "describe"
    }
    parentSuite := nearestJestDescribeAncestor(node)
    key := jestSuiteKey(parentSuite) + ":" + group + ":" + title
    if seen[key] != nil {
      ctx.Report(node, "Duplicate Jest "+group+" title "+fmt.Sprintf("%q", title)+".")
      return
    }
    seen[key] = node
  })
}

func runJestValidExpect(ctx *Context, root *shimast.Node) {
  walkDescendants(root, func(node *shimast.Node) {
    if !isJestExpectCallNode(node) {
      return
    }
    call := node.AsCallExpression()
    argc := 0
    if call != nil && call.Arguments != nil {
      argc = len(call.Arguments.Nodes)
    }
    if argc != 1 {
      ctx.Report(node, "Expect must have exactly one argument.")
      return
    }
    parent := node.Parent
    if parent == nil || parent.Kind != shimast.KindPropertyAccessExpression {
      ctx.Report(node, "Expect must call a matcher.")
      return
    }
    cur := parent
    for cur.Parent != nil && cur.Parent.Kind == shimast.KindPropertyAccessExpression {
      cur = cur.Parent
    }
    if cur.Parent == nil || cur.Parent.Kind != shimast.KindCallExpression {
      ctx.Report(cur, "Expect matcher must be called.")
    }
  })
}

func runJestPreferToHaveLength(ctx *Context, root *shimast.Node) {
  forEachJestCall(root, func(chain []string) bool {
    if len(chain) == 0 {
      return false
    }
    switch chain[len(chain)-1] {
    case "toBe", "toEqual", "toStrictEqual":
      return true
    }
    return false
  }, func(node *shimast.Node, call *shimast.CallExpression, _ []string) {
    expectCall := jestExpectCallFromMatcher(call.Expression)
    if expectCall == nil || !isJestLengthAccess(jestCallArgument(expectCall, 0)) {
      return
    }
    ctx.Report(node, "Prefer toHaveLength() for length assertions.")
  })
}

func runJestValidDescribeCallback(ctx *Context, root *shimast.Node) {
  forEachJestCall(root, isJestDescribeCall, func(node *shimast.Node, call *shimast.CallExpression, _ []string) {
    callback := jestCallbackArg(call)
    if callback == nil {
      ctx.Report(node, "Jest describe must have a callback.")
      return
    }
    if hasAsyncModifier(callback) {
      ctx.Report(callback, "Jest describe callback must not be async.")
    }
  })
}

func runJestValidTitle(ctx *Context, root *shimast.Node) {
  forEachJestCall(root, isJestTestLikeCall, func(node *shimast.Node, call *shimast.CallExpression, _ []string) {
    title, ok := jestTitleText(call)
    if !ok || strings.TrimSpace(title) == "" {
      ctx.Report(node, "Jest test title must be a non-empty string.")
    }
  })
}

func runJestNoDuplicateHooks(ctx *Context, root *shimast.Node) {
  seen := map[string]*shimast.Node{}
  forEachJestCall(root, isJestHookCall, func(node *shimast.Node, _ *shimast.CallExpression, chain []string) {
    parentSuite := nearestJestDescribeAncestor(node)
    key := jestSuiteKey(parentSuite) + ":" + chain[0]
    if seen[key] != nil {
      ctx.Report(node, "Duplicate Jest "+chain[0]+" hook.")
      return
    }
    seen[key] = node
  })
}

func runJestNoHooks(ctx *Context, root *shimast.Node) {
  forEachJestCall(root, isJestHookCall, func(node *shimast.Node, _ *shimast.CallExpression, _ []string) {
    ctx.Report(node, "Unexpected Jest hook.")
  })
}

func runJestNoTestReturnStatement(ctx *Context, root *shimast.Node) {
  forEachJestCall(root, isJestTestCall, func(_ *shimast.Node, call *shimast.CallExpression, _ []string) {
    callback := jestCallbackArg(call)
    if callback == nil || callback.Body() == nil {
      return
    }
    walkJestBody(callback.Body(), func(child *shimast.Node) {
      if child.Kind == shimast.KindReturnStatement {
        ctx.Report(child, "Unexpected return statement in Jest test.")
      }
    })
  })
}

func runJestRequireToThrowMessage(ctx *Context, root *shimast.Node) {
  forEachJestCall(root, func(chain []string) bool {
    if len(chain) == 0 {
      return false
    }
    last := chain[len(chain)-1]
    return last == "toThrow" || last == "toThrowError"
  }, func(node *shimast.Node, call *shimast.CallExpression, _ []string) {
    if jestExpectCallFromMatcher(call.Expression) == nil {
      return
    }
    if call.Arguments == nil || len(call.Arguments.Nodes) == 0 {
      ctx.Report(node, "Add an expected message to toThrow().")
    }
  })
}

func runJestMaxExpects(ctx *Context, root *shimast.Node) {
  forEachJestCall(root, isJestTestCall, func(node *shimast.Node, call *shimast.CallExpression, _ []string) {
    callback := jestCallbackArg(call)
    if callback == nil || callback.Body() == nil {
      return
    }
    count := 0
    walkJestBody(callback.Body(), func(child *shimast.Node) {
      if isJestExpectCallNode(child) {
        count++
      }
    })
    if count > 5 {
      ctx.Report(node, fmt.Sprintf("Jest test has too many assertions (%d > 5).", count))
    }
  })
}

func init() {
  Register(jestRule{name: "expect-expect", run: runJestExpectExpect})
  Register(jestRule{name: "max-expects", run: runJestMaxExpects})
  Register(jestRule{name: "no-conditional-expect", run: runJestNoConditionalExpect})
  Register(jestRule{name: "no-conditional-in-test", run: runJestNoConditionalInTest})
  Register(jestRule{name: "no-disabled-tests", run: runJestDisabledTests})
  Register(jestRule{name: "no-done-callback", run: runJestNoDoneCallback})
  Register(jestRule{name: "no-duplicate-hooks", run: runJestNoDuplicateHooks})
  Register(jestRule{name: "no-export", run: runJestNoExport})
  Register(jestRule{name: "no-focused-tests", run: runJestFocusedTests})
  Register(jestRule{name: "no-hooks", run: runJestNoHooks})
  Register(jestRule{name: "no-identical-title", run: runJestNoIdenticalTitle})
  Register(jestRule{name: "no-standalone-expect", run: runJestNoStandaloneExpect})
  Register(jestRule{name: "no-test-prefixes", run: runJestNoTestPrefixes})
  Register(jestRule{name: "no-test-return-statement", run: runJestNoTestReturnStatement})
  Register(jestRule{name: "prefer-to-have-length", run: runJestPreferToHaveLength})
  Register(jestRule{name: "require-to-throw-message", run: runJestRequireToThrowMessage})
  Register(jestRule{name: "valid-describe-callback", run: runJestValidDescribeCallback})
  Register(jestRule{name: "valid-expect", run: runJestValidExpect})
  Register(jestRule{name: "valid-title", run: runJestValidTitle})
}
