package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

type vitestExpectExpect struct{}
type vitestNoConditionalExpect struct{}
type vitestNoConditionalTests struct{}
type vitestNoDisabledTests struct{}
type vitestNoDoneCallback struct{}
type vitestNoFocusedTests struct{}
type vitestNoIdenticalTitle struct{}
type vitestNoStandaloneExpect struct{}
type vitestNoTestReturnStatement struct{}
type vitestPreferToHaveLength struct{}
type vitestValidDescribeCallback struct{}
type vitestValidExpect struct{}
type vitestValidTitle struct{}

func (vitestExpectExpect) Name() string { return "vitest/expect-expect" }
func (vitestExpectExpect) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindCallExpression}
}
func (vitestExpectExpect) Check(ctx *Context, node *shimast.Node) {
  call := node.AsCallExpression()
  if call == nil || vitestIsNestedCalleeCallNode(node) || !vitestIsTestCall(call) {
    return
  }
  body := vitestCallbackBody(call)
  if body == nil || vitestBodyHasAssertion(body) {
    return
  }
  ctx.Report(node, "Test has no expectation.")
}

func (vitestNoConditionalExpect) Name() string { return "vitest/no-conditional-expect" }
func (vitestNoConditionalExpect) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindCallExpression}
}
func (vitestNoConditionalExpect) Check(ctx *Context, node *shimast.Node) {
  call := node.AsCallExpression()
  if call == nil || !vitestIsExpectCall(call) || !vitestIsInsideTestFunction(node) {
    return
  }
  if vitestHasConditionalAncestorBeforeTest(node) {
    ctx.Report(node, "Avoid calling expect conditionally.")
  }
}

func (vitestNoConditionalTests) Name() string { return "vitest/no-conditional-tests" }
func (vitestNoConditionalTests) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindCallExpression}
}
func (vitestNoConditionalTests) Check(ctx *Context, node *shimast.Node) {
  call := node.AsCallExpression()
  if call == nil || vitestIsNestedCalleeCallNode(node) || !vitestIsAnyTestLikeCall(call) {
    return
  }
  if vitestHasConditionalAncestorBeforeFunction(node) {
    ctx.Report(node, "Do not declare Vitest tests conditionally.")
  }
}

func (vitestNoDisabledTests) Name() string { return "vitest/no-disabled-tests" }
func (vitestNoDisabledTests) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindCallExpression}
}
func (vitestNoDisabledTests) Check(ctx *Context, node *shimast.Node) {
  call := node.AsCallExpression()
  if vitestIsNestedCalleeCallNode(node) {
    return
  }
  info := vitestCallInfoOf(call)
  if !info.testLike {
    return
  }
  if info.has("skip") || info.has("todo") || info.root == "xit" || info.root == "xtest" || info.root == "xdescribe" {
    ctx.Report(node, "Disabled Vitest test.")
  }
}

func (vitestNoDoneCallback) Name() string { return "vitest/no-done-callback" }
func (vitestNoDoneCallback) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindCallExpression}
}
func (vitestNoDoneCallback) Check(ctx *Context, node *shimast.Node) {
  call := node.AsCallExpression()
  if call == nil || vitestIsNestedCalleeCallNode(node) || !vitestIsRunnableCall(call) {
    return
  }
  fn := vitestCallbackFunction(call)
  if fn == nil || len(fn.Parameters()) == 0 {
    return
  }
  ctx.Report(fn.Parameters()[0], "Do not use done callbacks in Vitest tests or hooks.")
}

func (vitestNoFocusedTests) Name() string { return "vitest/no-focused-tests" }
func (vitestNoFocusedTests) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindCallExpression}
}
func (vitestNoFocusedTests) Check(ctx *Context, node *shimast.Node) {
  call := node.AsCallExpression()
  if vitestIsNestedCalleeCallNode(node) {
    return
  }
  info := vitestCallInfoOf(call)
  if !info.testLike {
    return
  }
  if info.has("only") || info.root == "fit" || info.root == "fdescribe" {
    ctx.Report(node, "Unexpected focused Vitest test.")
  }
}

func (vitestNoIdenticalTitle) Name() string { return "vitest/no-identical-title" }
func (vitestNoIdenticalTitle) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindSourceFile}
}
func (vitestNoIdenticalTitle) Check(ctx *Context, node *shimast.Node) {
  vitestCheckDuplicateTitlesInScope(ctx, node, map[string]*shimast.Node{})
}

func (vitestNoStandaloneExpect) Name() string { return "vitest/no-standalone-expect" }
func (vitestNoStandaloneExpect) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindCallExpression}
}
func (vitestNoStandaloneExpect) Check(ctx *Context, node *shimast.Node) {
  call := node.AsCallExpression()
  if call == nil || !vitestIsExpectCall(call) {
    return
  }
  if !vitestIsInsideRunnableFunction(node) {
    ctx.Report(node, "Expect must be inside a Vitest test or hook.")
  }
}

func (vitestNoTestReturnStatement) Name() string { return "vitest/no-test-return-statement" }
func (vitestNoTestReturnStatement) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindReturnStatement}
}
func (vitestNoTestReturnStatement) Check(ctx *Context, node *shimast.Node) {
  if vitestIsInsideTestFunction(node) {
    ctx.Report(node, "Do not return from Vitest tests.")
  }
}

func (vitestPreferToHaveLength) Name() string { return "vitest/prefer-to-have-length" }
func (vitestPreferToHaveLength) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindCallExpression}
}
func (vitestPreferToHaveLength) Check(ctx *Context, node *shimast.Node) {
  call := node.AsCallExpression()
  if call == nil || call.Expression == nil || call.Expression.Kind != shimast.KindPropertyAccessExpression {
    return
  }
  access := call.Expression.AsPropertyAccessExpression()
  if access == nil {
    return
  }
  switch identifierText(access.Name()) {
  case "toBe", "toEqual", "toStrictEqual":
  default:
    return
  }
  receiver := stripParens(access.Expression)
  expectCall := vitestExpectCallFromMatcherReceiver(receiver)
  if expectCall == nil || expectCall.Arguments == nil || len(expectCall.Arguments.Nodes) != 1 {
    return
  }
  arg := stripParens(expectCall.Arguments.Nodes[0])
  if arg == nil || arg.Kind != shimast.KindPropertyAccessExpression {
    return
  }
  prop := arg.AsPropertyAccessExpression()
  if prop != nil && identifierText(prop.Name()) == "length" {
    ctx.Report(node, "Use toHaveLength() instead of asserting on .length.")
  }
}

func (vitestValidDescribeCallback) Name() string { return "vitest/valid-describe-callback" }
func (vitestValidDescribeCallback) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindCallExpression}
}
func (vitestValidDescribeCallback) Check(ctx *Context, node *shimast.Node) {
  call := node.AsCallExpression()
  if call == nil || vitestIsNestedCalleeCallNode(node) || !vitestIsDescribeCall(call) {
    return
  }
  fn := vitestCallbackFunction(call)
  if fn == nil {
    ctx.Report(node, "Describe must receive a callback function.")
    return
  }
  if hasAsyncModifier(fn) {
    ctx.Report(fn, "Describe callbacks must not be async.")
  }
}

func (vitestValidExpect) Name() string { return "vitest/valid-expect" }
func (vitestValidExpect) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindCallExpression}
}
func (vitestValidExpect) Check(ctx *Context, node *shimast.Node) {
  call := node.AsCallExpression()
  if call == nil || !vitestIsExpectSubjectCall(call) {
    return
  }
  if call.Arguments == nil || len(call.Arguments.Nodes) == 0 {
    ctx.Report(node, "Expect requires an argument.")
    return
  }
  if !vitestExpectCallHasMatcher(node) {
    ctx.Report(node, "Expect must be followed by a matcher call.")
  }
}

func (vitestValidTitle) Name() string { return "vitest/valid-title" }
func (vitestValidTitle) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindCallExpression}
}
func (vitestValidTitle) Check(ctx *Context, node *shimast.Node) {
  call := node.AsCallExpression()
  if call == nil || vitestIsNestedCalleeCallNode(node) || !vitestIsAnyTestLikeCall(call) {
    return
  }
  title := vitestTitleArg(call)
  if title == nil {
    ctx.Report(node, "Vitest test and describe calls require a title.")
    return
  }
  if vitestStaticTitle(title) == "" {
    ctx.Report(title, "Vitest titles must be non-empty static strings.")
  }
}

type vitestCallInfo struct {
  root     string
  mods     []string
  testLike bool
}

func (i vitestCallInfo) has(mod string) bool {
  for _, item := range i.mods {
    if item == mod {
      return true
    }
  }
  return false
}

func vitestCallInfoOf(call *shimast.CallExpression) vitestCallInfo {
  if call == nil || call.Expression == nil {
    return vitestCallInfo{}
  }
  root, mods := vitestCalleeRootAndMods(call.Expression)
  info := vitestCallInfo{root: root, mods: mods}
  switch root {
  case "describe", "test", "it", "suite", "fdescribe", "fit", "xdescribe", "xit", "xtest":
    info.testLike = true
  }
  return info
}

func vitestCalleeRootAndMods(node *shimast.Node) (string, []string) {
  node = stripParens(node)
  if node == nil {
    return "", nil
  }
  switch node.Kind {
  case shimast.KindIdentifier:
    return identifierText(node), nil
  case shimast.KindPropertyAccessExpression:
    access := node.AsPropertyAccessExpression()
    if access == nil {
      return "", nil
    }
    root, mods := vitestCalleeRootAndMods(access.Expression)
    if name := identifierText(access.Name()); name != "" {
      mods = append(mods, name)
    }
    return root, mods
  case shimast.KindCallExpression:
    inner := node.AsCallExpression()
    if inner == nil {
      return "", nil
    }
    return vitestCalleeRootAndMods(inner.Expression)
  }
  return "", nil
}

func vitestIsAnyTestLikeCall(call *shimast.CallExpression) bool {
  return vitestCallInfoOf(call).testLike
}

func vitestIsTestCall(call *shimast.CallExpression) bool {
  switch vitestCallInfoOf(call).root {
  case "test", "it", "fit", "xit", "xtest":
    return true
  }
  return false
}

func vitestIsDescribeCall(call *shimast.CallExpression) bool {
  switch vitestCallInfoOf(call).root {
  case "describe", "suite", "fdescribe", "xdescribe":
    return true
  }
  return false
}

func vitestIsHookCall(call *shimast.CallExpression) bool {
  switch vitestCallInfoOf(call).root {
  case "beforeAll", "beforeEach", "afterAll", "afterEach":
    return true
  }
  return false
}

func vitestIsRunnableCall(call *shimast.CallExpression) bool {
  return vitestIsTestCall(call) || vitestIsHookCall(call)
}

func vitestTitleArg(call *shimast.CallExpression) *shimast.Node {
  if call == nil || call.Arguments == nil || len(call.Arguments.Nodes) == 0 {
    return nil
  }
  return call.Arguments.Nodes[0]
}

func vitestCallbackFunction(call *shimast.CallExpression) *shimast.Node {
  if call == nil || call.Arguments == nil {
    return nil
  }
  for i := len(call.Arguments.Nodes) - 1; i >= 0; i-- {
    arg := stripParens(call.Arguments.Nodes[i])
    if arg == nil {
      continue
    }
    switch arg.Kind {
    case shimast.KindArrowFunction, shimast.KindFunctionExpression:
      return arg
    }
  }
  return nil
}

func vitestCallbackBody(call *shimast.CallExpression) *shimast.Node {
  fn := vitestCallbackFunction(call)
  if fn == nil {
    return nil
  }
  return fn.Body()
}

func vitestStaticTitle(node *shimast.Node) string {
  return stringLiteralText(stripParens(node))
}

func vitestIsExpectCall(call *shimast.CallExpression) bool {
  if call == nil || call.Expression == nil {
    return false
  }
  root, mods := vitestCalleeRootAndMods(call.Expression)
  if root == "expect" {
    return len(mods) == 0 || len(mods) == 1 && mods[0] == "soft"
  }
  return root == "expectTypeOf" || root == "assert"
}

func vitestIsExpectSubjectCall(call *shimast.CallExpression) bool {
  if call == nil || call.Expression == nil {
    return false
  }
  root, mods := vitestCalleeRootAndMods(call.Expression)
  if root == "expect" {
    return len(mods) == 0 || len(mods) == 1 && mods[0] == "soft"
  }
  return root == "expectTypeOf"
}

func vitestBodyHasAssertion(body *shimast.Node) bool {
  found := false
  walkDescendants(body, func(child *shimast.Node) {
    if found || child == nil || child.Kind != shimast.KindCallExpression {
      return
    }
    call := child.AsCallExpression()
    if call != nil && vitestIsExpectCall(call) {
      found = true
    }
  })
  return found
}

func vitestIsInsideRunnableFunction(node *shimast.Node) bool {
  return vitestEnclosingRunnableCall(node, true) != nil
}

func vitestIsInsideTestFunction(node *shimast.Node) bool {
  call := vitestEnclosingRunnableCall(node, false)
  return call != nil && vitestIsTestCall(call.AsCallExpression())
}

func vitestEnclosingRunnableCall(node *shimast.Node, allowHooks bool) *shimast.Node {
  for p := node.Parent; p != nil; p = p.Parent {
    if !isFunctionLikeKind(p) {
      continue
    }
    if p.Parent == nil || p.Parent.Kind != shimast.KindCallExpression {
      return nil
    }
    call := p.Parent.AsCallExpression()
    if call == nil {
      return nil
    }
    if vitestIsTestCall(call) || allowHooks && vitestIsHookCall(call) {
      return p.Parent
    }
    return nil
  }
  return nil
}

func vitestHasConditionalAncestorBeforeTest(node *shimast.Node) bool {
  for p := node.Parent; p != nil; p = p.Parent {
    if vitestIsConditionalNode(p) {
      return true
    }
    if isFunctionLikeKind(p) {
      return vitestIsInsideTestFunction(p)
    }
  }
  return false
}

func vitestHasConditionalAncestorBeforeFunction(node *shimast.Node) bool {
  for p := node.Parent; p != nil; p = p.Parent {
    if vitestIsConditionalNode(p) {
      return true
    }
    if isFunctionLikeKind(p) {
      return false
    }
  }
  return false
}

func vitestIsConditionalNode(node *shimast.Node) bool {
  if node == nil {
    return false
  }
  switch node.Kind {
  case shimast.KindIfStatement,
    shimast.KindConditionalExpression,
    shimast.KindSwitchStatement,
    shimast.KindForStatement,
    shimast.KindForInStatement,
    shimast.KindForOfStatement,
    shimast.KindWhileStatement,
    shimast.KindDoStatement:
    return true
  }
  return false
}

func vitestExpectCallHasMatcher(expectNode *shimast.Node) bool {
  for p := expectNode.Parent; p != nil; p = p.Parent {
    if p.Kind == shimast.KindCallExpression {
      return p != expectNode
    }
    if p.Kind != shimast.KindPropertyAccessExpression {
      return false
    }
    access := p.AsPropertyAccessExpression()
    if access == nil {
      return false
    }
    switch identifierText(access.Name()) {
    case "not", "resolves", "rejects":
      continue
    default:
      return p.Parent != nil && p.Parent.Kind == shimast.KindCallExpression
    }
  }
  return false
}

func vitestExpectCallFromMatcherReceiver(node *shimast.Node) *shimast.CallExpression {
  node = stripParens(node)
  for node != nil && node.Kind == shimast.KindPropertyAccessExpression {
    access := node.AsPropertyAccessExpression()
    if access == nil {
      return nil
    }
    node = stripParens(access.Expression)
  }
  if node == nil || node.Kind != shimast.KindCallExpression {
    return nil
  }
  call := node.AsCallExpression()
  if vitestIsExpectSubjectCall(call) {
    return call
  }
  return nil
}

func vitestIsNestedCalleeCallNode(node *shimast.Node) bool {
  if node == nil || node.Parent == nil || node.Parent.Kind != shimast.KindCallExpression {
    return false
  }
  parent := node.Parent.AsCallExpression()
  return parent != nil && parent.Expression == node
}

func vitestCheckDuplicateTitlesInScope(ctx *Context, node *shimast.Node, seen map[string]*shimast.Node) {
  if node == nil {
    return
  }
  if node.Kind == shimast.KindCallExpression {
    call := node.AsCallExpression()
    if call != nil && !vitestIsNestedCalleeCallNode(node) && vitestIsAnyTestLikeCall(call) {
      titleNode := vitestTitleArg(call)
      title := vitestStaticTitle(titleNode)
      if title != "" {
        key := vitestTitleKind(call) + "\x00" + title
        if seen[key] != nil {
          ctx.Report(titleNode, "Duplicate Vitest title '"+title+"'.")
        } else {
          seen[key] = titleNode
        }
      }
      if vitestIsDescribeCall(call) {
        if body := vitestCallbackBody(call); body != nil {
          vitestCheckDuplicateTitlesInScope(ctx, body, map[string]*shimast.Node{})
        }
      }
      return
    }
  }
  node.ForEachChild(func(child *shimast.Node) bool {
    vitestCheckDuplicateTitlesInScope(ctx, child, seen)
    return false
  })
}

func vitestTitleKind(call *shimast.CallExpression) string {
  if vitestIsDescribeCall(call) {
    return "describe"
  }
  return "test"
}

func init() {
  Register(vitestExpectExpect{})
  Register(vitestNoConditionalExpect{})
  Register(vitestNoConditionalTests{})
  Register(vitestNoDisabledTests{})
  Register(vitestNoDoneCallback{})
  Register(vitestNoFocusedTests{})
  Register(vitestNoIdenticalTitle{})
  Register(vitestNoStandaloneExpect{})
  Register(vitestNoTestReturnStatement{})
  Register(vitestPreferToHaveLength{})
  Register(vitestValidDescribeCallback{})
  Register(vitestValidExpect{})
  Register(vitestValidTitle{})
}
