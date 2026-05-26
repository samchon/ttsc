package linthost

import (
  "fmt"
  "sort"
  "strings"
  "unicode"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

type reactHooksRule struct {
  name string
}

func (r reactHooksRule) Name() string { return r.name }
func (r reactHooksRule) Visits() []shimast.Kind {
  switch r.name {
  case "react-hooks/rules-of-hooks", "react-hooks/exhaustive-deps", "react-hooks/use-memo":
    return []shimast.Kind{shimast.KindCallExpression}
  }
  return []shimast.Kind{shimast.KindSourceFile}
}
func (r reactHooksRule) Check(ctx *Context, node *shimast.Node) {
  switch r.name {
  case "react-hooks/rules-of-hooks":
    checkReactRulesOfHooksCall(ctx, node)
    return
  case "react-hooks/exhaustive-deps":
    checkReactExhaustiveDepsCall(ctx, node)
    return
  case "react-hooks/use-memo":
    checkReactUseMemoCall(ctx, node)
    return
  }
  analyzer := newReactHooksAnalyzer(ctx, node)
  switch r.name {
  case "react-hooks/component-hook-factories":
    analyzer.checkComponentHookFactories(node)
  case "react-hooks/set-state-in-render":
    analyzer.checkSetStateInRender(node)
  case "react-hooks/set-state-in-effect":
    analyzer.checkSetStateInEffect(node)
  case "react-hooks/immutability":
    analyzer.checkImmutability(node)
  case "react-hooks/refs":
    analyzer.checkRefs(node)
  }
}

func checkReactRulesOfHooksCall(ctx *Context, node *shimast.Node) {
  call := node.AsCallExpression()
  if call == nil || !isReactHookCallee(call.Expression) {
    return
  }
  hookName := reactCalleeName(call.Expression)
  fnNode := nearestFunctionNode(node.Parent)
  if fnNode == nil {
    ctx.Report(node, fmt.Sprintf("React Hook %q cannot be called at the top level.", hookName))
    return
  }
  fnName := reactFunctionName(fnNode)
  component := isReactComponentName(fnName) || reactFunctionBodyContainsJSX(reactFunctionBody(fnNode))
  hook := isReactHookName(fnName)
  if !component && !hook {
    ctx.Report(node, fmt.Sprintf("React Hook %q is called in a function that is neither a React component nor a custom Hook.", hookName))
    return
  }
  if conditional := firstConditionalHookAncestor(node, fnNode); conditional != nil {
    ctx.Report(node, fmt.Sprintf("React Hook %q is called conditionally.", hookName))
    return
  }
  if conditional := firstConditionalReturnBeforeHook(node, fnNode); conditional != nil {
    ctx.Report(node, fmt.Sprintf("React Hook %q is called conditionally.", hookName))
  }
}

func checkReactExhaustiveDepsCall(ctx *Context, node *shimast.Node) {
  call := node.AsCallExpression()
  if call == nil || !isReactDependencyHook(call.Expression) || call.Arguments == nil || len(call.Arguments.Nodes) < 2 {
    return
  }
  callback := stripParens(call.Arguments.Nodes[0])
  depsNode := stripParens(call.Arguments.Nodes[1])
  if !isReactFunctionLike(callback) || depsNode == nil || depsNode.Kind != shimast.KindArrayLiteralExpression {
    return
  }
  used := collectReactHookCallbackReads(callback)
  deps := collectReactHookDependencyNames(depsNode)
  missing := missingReactHookDependencies(used, deps)
  if len(missing) == 0 {
    return
  }
  ctx.Report(depsNode, "React Hook has missing dependencies: "+formatQuotedList(missing)+".")
}

func checkReactUseMemoCall(ctx *Context, node *shimast.Node) {
  call := node.AsCallExpression()
  if call == nil || !isNamedReactCallee(call.Expression, "useMemo") || call.Arguments == nil || len(call.Arguments.Nodes) == 0 {
    return
  }
  callback := stripParens(call.Arguments.Nodes[0])
  if !isReactFunctionLike(callback) {
    return
  }
  body := reactFunctionBody(callback)
  if body == nil || body.Kind != shimast.KindBlock || functionBlockHasOwnReturn(callback, body) {
    return
  }
  ctx.Report(callback, "useMemo callback must return a value.")
}

type reactHooksAnalyzer struct {
  ctx       *Context
  functions map[*shimast.Node]*reactHooksFunction
}

type reactHooksFunction struct {
  node        *shimast.Node
  body        *shimast.Node
  name        string
  component   bool
  hook        bool
  props       map[string]bool
  stateValues map[string]bool
  setters     map[string]bool
  refs        map[string]bool
}

func newReactHooksAnalyzer(ctx *Context, root *shimast.Node) *reactHooksAnalyzer {
  a := &reactHooksAnalyzer{
    ctx:       ctx,
    functions: map[*shimast.Node]*reactHooksFunction{},
  }
  walkDescendants(root, func(node *shimast.Node) {
    if !isReactFunctionLike(node) {
      return
    }
    fn := &reactHooksFunction{
      node:        node,
      body:        reactFunctionBody(node),
      name:        reactFunctionName(node),
      props:       map[string]bool{},
      stateValues: map[string]bool{},
      setters:     map[string]bool{},
      refs:        map[string]bool{},
    }
    fn.component = isReactComponentName(fn.name) || reactFunctionBodyContainsJSX(fn.body)
    fn.hook = isReactHookName(fn.name)
    a.functions[node] = fn
  })
  for _, fn := range a.functions {
    a.collectFunctionBindings(fn)
  }
  return a
}

func (a *reactHooksAnalyzer) checkComponentHookFactories(root *shimast.Node) {
  walkDescendants(root, func(node *shimast.Node) {
    if !isReactFunctionLike(node) {
      return
    }
    outer := a.nearestFunction(node.Parent)
    nested := a.functions[node]
    if outer == nil || nested == nil || (!outer.component && !outer.hook) || (!nested.component && !nested.hook) {
      return
    }
    if !functionContainsReactHookCall(node) {
      return
    }
    a.ctx.Report(node, "Do not define a component or Hook factory inside another component or Hook.")
  })
}

func (a *reactHooksAnalyzer) checkSetStateInRender(root *shimast.Node) {
  walkDescendants(root, func(node *shimast.Node) {
    call := node.AsCallExpression()
    if call == nil {
      return
    }
    name := callCalleeName(call)
    if name == "" {
      return
    }
    fn := a.nearestFunction(node)
    if fn == nil || (!fn.component && !fn.hook) || !fn.setters[name] {
      return
    }
    a.ctx.Report(node, "Do not call a state setter during render.")
  })
}

func (a *reactHooksAnalyzer) checkSetStateInEffect(root *shimast.Node) {
  walkDescendants(root, func(node *shimast.Node) {
    call := node.AsCallExpression()
    if call == nil {
      return
    }
    name := callCalleeName(call)
    if name == "" {
      return
    }
    callback := a.nearestFunction(node)
    if callback == nil || !isEffectCallback(callback.node) {
      return
    }
    owner := a.nearestReactFunction(callback.node.Parent)
    if owner == nil || !owner.setters[name] {
      return
    }
    a.ctx.Report(node, "Do not synchronously call a state setter inside an effect.")
  })
}

func (a *reactHooksAnalyzer) checkImmutability(root *shimast.Node) {
  walkDescendants(root, func(node *shimast.Node) {
    switch node.Kind {
    case shimast.KindBinaryExpression:
      expr := node.AsBinaryExpression()
      if expr == nil || expr.OperatorToken == nil || !isAssignmentOperator(expr.OperatorToken.Kind) {
        return
      }
      a.reportImmutableWrite(expr.Left, node)
    case shimast.KindPrefixUnaryExpression:
      expr := node.AsPrefixUnaryExpression()
      if expr == nil || (expr.Operator != shimast.KindPlusPlusToken && expr.Operator != shimast.KindMinusMinusToken) {
        return
      }
      a.reportImmutableWrite(expr.Operand, node)
    case shimast.KindPostfixUnaryExpression:
      expr := node.AsPostfixUnaryExpression()
      if expr == nil || (expr.Operator != shimast.KindPlusPlusToken && expr.Operator != shimast.KindMinusMinusToken) {
        return
      }
      a.reportImmutableWrite(expr.Operand, node)
    }
  })
}

func (a *reactHooksAnalyzer) reportImmutableWrite(target *shimast.Node, reportNode *shimast.Node) {
  target = stripParens(target)
  if target == nil || (target.Kind != shimast.KindPropertyAccessExpression && target.Kind != shimast.KindElementAccessExpression) {
    return
  }
  fn := a.nearestReactFunction(reportNode)
  if fn == nil {
    return
  }
  root := memberAccessRootName(target)
  if root == "" || (!fn.props[root] && !fn.stateValues[root]) {
    return
  }
  a.ctx.Report(reportNode, "Do not mutate props or state directly.")
}

func (a *reactHooksAnalyzer) checkRefs(root *shimast.Node) {
  walkDescendants(root, func(node *shimast.Node) {
    access := node.AsPropertyAccessExpression()
    if access == nil || identifierText(access.Name()) != "current" {
      return
    }
    fn := a.nearestFunction(node)
    if fn == nil || (!fn.component && !fn.hook) || !fn.refs[memberAccessRootName(node)] {
      return
    }
    a.ctx.Report(node, "Do not read or write ref.current during render.")
  })
}

func (a *reactHooksAnalyzer) collectFunctionBindings(fn *reactHooksFunction) {
  if fn == nil || fn.body == nil {
    return
  }
  if params := reactFunctionParameters(fn.node); params != nil && len(params.Nodes) > 0 {
    name := parameterName(params.Nodes[0])
    if name != "" {
      fn.props[name] = true
    }
  }
  walkDescendants(fn.body, func(node *shimast.Node) {
    if a.nearestFunction(node) != fn {
      return
    }
    decl := node.AsVariableDeclaration()
    if decl == nil || decl.Initializer == nil {
      return
    }
    if isNamedReactCalleeFromCall(decl.Initializer, "useState") {
      names := bindingPatternNames(decl.Name())
      if len(names) == 0 {
        names = parseSimpleArrayBindingNames(nodeText(a.ctx.File, decl.Name()))
      }
      if len(names) > 0 {
        fn.stateValues[names[0]] = true
      }
      if len(names) > 1 {
        fn.setters[names[1]] = true
      }
      return
    }
    if isNamedReactCalleeFromCall(decl.Initializer, "useReducer") {
      names := bindingPatternNames(decl.Name())
      if len(names) == 0 {
        names = parseSimpleArrayBindingNames(nodeText(a.ctx.File, decl.Name()))
      }
      if len(names) > 0 {
        fn.stateValues[names[0]] = true
      }
      if len(names) > 1 {
        fn.setters[names[1]] = true
      }
      return
    }
    if isNamedReactCalleeFromCall(decl.Initializer, "useRef") {
      if name := identifierText(decl.Name()); name != "" {
        fn.refs[name] = true
      }
    }
  })
}

func (a *reactHooksAnalyzer) nearestFunction(node *shimast.Node) *reactHooksFunction {
  for cur := node; cur != nil; cur = cur.Parent {
    if fn, ok := a.functions[cur]; ok {
      return fn
    }
  }
  return nil
}

func (a *reactHooksAnalyzer) nearestReactFunction(node *shimast.Node) *reactHooksFunction {
  for cur := node; cur != nil; cur = cur.Parent {
    if fn, ok := a.functions[cur]; ok && (fn.component || fn.hook) {
      return fn
    }
  }
  return nil
}

func isReactFunctionLike(node *shimast.Node) bool {
  if node == nil {
    return false
  }
  switch node.Kind {
  case shimast.KindFunctionDeclaration, shimast.KindFunctionExpression, shimast.KindArrowFunction:
    return true
  }
  return false
}

func reactFunctionBody(node *shimast.Node) *shimast.Node {
  if node == nil {
    return nil
  }
  switch node.Kind {
  case shimast.KindFunctionDeclaration:
    if fn := node.AsFunctionDeclaration(); fn != nil {
      return fn.Body
    }
  case shimast.KindFunctionExpression:
    if fn := node.AsFunctionExpression(); fn != nil {
      return fn.Body
    }
  case shimast.KindArrowFunction:
    if fn := node.AsArrowFunction(); fn != nil {
      return fn.Body
    }
  }
  return nil
}

func reactFunctionParameters(node *shimast.Node) *shimast.NodeList {
  if node == nil {
    return nil
  }
  switch node.Kind {
  case shimast.KindFunctionDeclaration:
    if fn := node.AsFunctionDeclaration(); fn != nil {
      return fn.Parameters
    }
  case shimast.KindFunctionExpression:
    if fn := node.AsFunctionExpression(); fn != nil {
      return fn.Parameters
    }
  case shimast.KindArrowFunction:
    if fn := node.AsArrowFunction(); fn != nil {
      return fn.Parameters
    }
  }
  return nil
}

func reactFunctionName(node *shimast.Node) string {
  if node == nil {
    return ""
  }
  switch node.Kind {
  case shimast.KindFunctionDeclaration:
    if fn := node.AsFunctionDeclaration(); fn != nil {
      if name := identifierText(fn.Name()); name != "" {
        return name
      }
    }
  case shimast.KindFunctionExpression:
    if fn := node.AsFunctionExpression(); fn != nil {
      if name := identifierText(fn.Name()); name != "" {
        return name
      }
    }
  }
  if parent := node.Parent; parent != nil {
    switch parent.Kind {
    case shimast.KindVariableDeclaration:
      if decl := parent.AsVariableDeclaration(); decl != nil && decl.Initializer == node {
        return identifierText(decl.Name())
      }
    case shimast.KindBinaryExpression:
      if expr := parent.AsBinaryExpression(); expr != nil && expr.Right == node {
        return identifierText(expr.Left)
      }
    case shimast.KindPropertyAssignment:
      if prop := parent.AsPropertyAssignment(); prop != nil && prop.Initializer == node {
        return identifierText(prop.Name())
      }
    }
  }
  return ""
}

func isReactComponentName(name string) bool {
  if name == "" {
    return false
  }
	first, _ := reactHooksFirstRune(name)
  return unicode.IsUpper(first)
}

func isReactHookName(name string) bool {
  if len(name) < 4 || !strings.HasPrefix(name, "use") {
    return false
  }
	r, _ := reactHooksFirstRune(name[3:])
  return unicode.IsUpper(r) || unicode.IsDigit(r)
}

func reactHooksFirstRune(text string) (rune, int) {
  for i, r := range text {
    return r, i
  }
  return 0, 0
}

func reactFunctionBodyContainsJSX(body *shimast.Node) bool {
  found := false
  walkDescendants(body, func(node *shimast.Node) {
    if found || node == nil {
      return
    }
    switch node.Kind {
    case shimast.KindJsxElement, shimast.KindJsxSelfClosingElement, shimast.KindJsxFragment:
      found = true
    }
  })
  return found
}

func reactCalleeName(node *shimast.Node) string {
  node = stripParens(node)
  if name := identifierText(node); name != "" {
    return name
  }
  if node != nil && node.Kind == shimast.KindPropertyAccessExpression {
    access := node.AsPropertyAccessExpression()
    if access != nil {
      return identifierText(access.Name())
    }
  }
  return ""
}

func isReactHookCallee(node *shimast.Node) bool {
  return isReactHookName(reactCalleeName(node))
}

func isNamedReactCallee(node *shimast.Node, name string) bool {
  return reactCalleeName(node) == name
}

func isNamedReactCalleeFromCall(node *shimast.Node, name string) bool {
  call := stripParens(node).AsCallExpression()
  return call != nil && isNamedReactCallee(call.Expression, name)
}

func isReactDependencyHook(node *shimast.Node) bool {
  switch reactCalleeName(node) {
  case "useEffect", "useLayoutEffect", "useInsertionEffect", "useMemo", "useCallback":
    return true
  }
  return false
}

func firstConditionalHookAncestor(node *shimast.Node, stop *shimast.Node) *shimast.Node {
  for cur := node.Parent; cur != nil && cur != stop; cur = cur.Parent {
    switch cur.Kind {
    case shimast.KindIfStatement,
      shimast.KindConditionalExpression,
      shimast.KindSwitchStatement,
      shimast.KindCaseClause,
      shimast.KindDefaultClause,
      shimast.KindForStatement,
      shimast.KindForInStatement,
      shimast.KindForOfStatement,
      shimast.KindWhileStatement,
      shimast.KindDoStatement,
      shimast.KindCatchClause:
      return cur
    }
  }
  return nil
}

func firstConditionalReturnBeforeHook(node *shimast.Node, fnNode *shimast.Node) *shimast.Node {
  for cur := node; cur != nil && cur != fnNode; cur = cur.Parent {
    parent := cur.Parent
    if parent == nil || parent.Kind != shimast.KindBlock {
      continue
    }
    for _, stmt := range parentStatements(parent) {
      if stmt == cur {
        break
      }
      if statementIsConditionalReturn(stmt, fnNode) {
        return stmt
      }
    }
  }
  return nil
}

func statementIsConditionalReturn(stmt *shimast.Node, fnNode *shimast.Node) bool {
  if stmt == nil || stmt.Kind != shimast.KindIfStatement {
    return false
  }
  ifs := stmt.AsIfStatement()
  if ifs == nil {
    return false
  }
  return statementContainsOwnReturn(ifs.ThenStatement, fnNode) ||
    statementContainsOwnReturn(ifs.ElseStatement, fnNode)
}

func statementContainsOwnReturn(stmt *shimast.Node, fnNode *shimast.Node) bool {
  found := false
  walkDescendants(stmt, func(node *shimast.Node) {
    if found || node == nil || node.Kind != shimast.KindReturnStatement {
      return
    }
    found = nearestFunctionNode(node) == fnNode
  })
  return found
}

func functionContainsReactHookCall(node *shimast.Node) bool {
  found := false
  walkDescendants(reactFunctionBody(node), func(child *shimast.Node) {
    if found || child == node {
      return
    }
    call := child.AsCallExpression()
    if call != nil && isReactHookCallee(call.Expression) {
      found = true
    }
  })
  return found
}

func isEffectCallback(fnNode *shimast.Node) bool {
  if fnNode == nil || fnNode.Parent == nil || fnNode.Parent.Kind != shimast.KindCallExpression {
    return false
  }
  call := fnNode.Parent.AsCallExpression()
  return call != nil && call.Arguments != nil && len(call.Arguments.Nodes) > 0 &&
    stripParens(call.Arguments.Nodes[0]) == fnNode &&
    isNamedReactCallee(call.Expression, "useEffect")
}

func functionBlockHasOwnReturn(fnNode *shimast.Node, body *shimast.Node) bool {
  found := false
  walkDescendants(body, func(node *shimast.Node) {
    if found {
      return
    }
    if node != body && isReactFunctionLike(node) {
      return
    }
    if node.Kind == shimast.KindReturnStatement && nearestFunctionNode(node) == fnNode {
      found = true
    }
  })
  return found
}

func nearestFunctionNode(node *shimast.Node) *shimast.Node {
  for cur := node; cur != nil; cur = cur.Parent {
    if isReactFunctionLike(cur) {
      return cur
    }
  }
  return nil
}

func collectReactHookCallbackReads(callback *shimast.Node) map[string]bool {
  declared := map[string]bool{}
  used := map[string]bool{}
  if params := reactFunctionParameters(callback); params != nil {
    for _, param := range params.Nodes {
      collectBindingNames(param.AsParameterDeclaration().Name(), declared)
    }
  }
  walkDescendants(reactFunctionBody(callback), func(node *shimast.Node) {
    if nearestFunctionNode(node) != callback {
      return
    }
    switch node.Kind {
    case shimast.KindVariableDeclaration:
      if decl := node.AsVariableDeclaration(); decl != nil {
        collectBindingNames(decl.Name(), declared)
      }
    case shimast.KindFunctionDeclaration:
      if fn := node.AsFunctionDeclaration(); fn != nil {
        collectBindingNames(fn.Name(), declared)
      }
    case shimast.KindIdentifier:
      name := identifierText(node)
      if name == "" || declared[name] || isReactHookStableName(name) || !isIdentifierRead(node) {
        return
      }
      used[name] = true
    }
  })
  return used
}

func collectReactHookDependencyNames(depsNode *shimast.Node) map[string]bool {
  deps := map[string]bool{}
  arr := depsNode.AsArrayLiteralExpression()
  if arr == nil || arr.Elements == nil {
    return deps
  }
  for _, element := range arr.Elements.Nodes {
    name := identifierText(stripParens(element))
    if name == "" {
      name = memberAccessRootName(element)
    }
    if name != "" {
      deps[name] = true
    }
  }
  return deps
}

func missingReactHookDependencies(used map[string]bool, deps map[string]bool) []string {
  var missing []string
  for name := range used {
    if !deps[name] {
      missing = append(missing, name)
    }
  }
  sort.Strings(missing)
  return missing
}

func isIdentifierRead(node *shimast.Node) bool {
  if node == nil || node.Kind != shimast.KindIdentifier || node.Parent == nil {
    return false
  }
  parent := node.Parent
  switch parent.Kind {
  case shimast.KindVariableDeclaration:
    decl := parent.AsVariableDeclaration()
    return decl == nil || decl.Name() != node
  case shimast.KindBindingElement:
    elem := parent.AsBindingElement()
    return elem == nil || elem.Name() != node
  case shimast.KindParameter:
    param := parent.AsParameterDeclaration()
    return param == nil || param.Name() != node
  case shimast.KindFunctionDeclaration:
    fn := parent.AsFunctionDeclaration()
    return fn == nil || fn.Name() != node
  case shimast.KindFunctionExpression:
    fn := parent.AsFunctionExpression()
    return fn == nil || fn.Name() != node
  case shimast.KindPropertyAccessExpression:
    access := parent.AsPropertyAccessExpression()
    return access == nil || access.Name() != node
  case shimast.KindPropertyAssignment:
    prop := parent.AsPropertyAssignment()
    return prop == nil || prop.Name() != node
  }
  return true
}

func isReactHookStableName(name string) bool {
  switch name {
  case "console", "Math", "Date", "JSON", "Object", "Array", "String", "Number", "Boolean", "Promise",
    "React", "window", "document", "undefined", "NaN", "Infinity", "setTimeout", "clearTimeout",
    "setInterval", "clearInterval", "queueMicrotask", "requestAnimationFrame", "cancelAnimationFrame":
    return true
  }
  return strings.HasPrefix(name, "set") && len(name) > 3 && unicode.IsUpper([]rune(name[3:])[0])
}

func bindingPatternNames(node *shimast.Node) []string {
  names := []string{}
  collectBindingNamesOrdered(node, &names, map[string]bool{})
  return names
}

func parseSimpleArrayBindingNames(text string) []string {
  text = strings.TrimSpace(text)
  if !strings.HasPrefix(text, "[") || !strings.HasSuffix(text, "]") {
    return nil
  }
  inner := strings.TrimSuffix(strings.TrimPrefix(text, "["), "]")
  parts := strings.Split(inner, ",")
  names := make([]string, 0, len(parts))
  for _, part := range parts {
    part = strings.TrimSpace(part)
    if part == "" {
      continue
    }
    if idx := strings.Index(part, "="); idx >= 0 {
      part = strings.TrimSpace(part[:idx])
    }
    if strings.HasPrefix(part, "...") {
      part = strings.TrimSpace(strings.TrimPrefix(part, "..."))
    }
    if isReactSimpleIdentifierName(part) {
      names = append(names, part)
    }
  }
  return names
}

func isReactSimpleIdentifierName(text string) bool {
  if text == "" {
    return false
  }
  for i, r := range text {
    if i == 0 {
      if r != '_' && r != '$' && !unicode.IsLetter(r) {
        return false
      }
      continue
    }
    if r != '_' && r != '$' && !unicode.IsLetter(r) && !unicode.IsDigit(r) {
      return false
    }
  }
  return true
}

func collectBindingNames(node *shimast.Node, out map[string]bool) {
  if node == nil {
    return
  }
  if name := identifierText(node); name != "" {
    out[name] = true
    return
  }
  node.ForEachChild(func(child *shimast.Node) bool {
    collectBindingNames(child, out)
    return false
  })
}

func collectBindingNamesOrdered(node *shimast.Node, names *[]string, seen map[string]bool) {
  if node == nil {
    return
  }
  if name := identifierText(node); name != "" {
    if !seen[name] {
      seen[name] = true
      *names = append(*names, name)
    }
    return
  }
  node.ForEachChild(func(child *shimast.Node) bool {
    collectBindingNamesOrdered(child, names, seen)
    return false
  })
}

func memberAccessRootName(node *shimast.Node) string {
  node = stripParens(node)
  for node != nil {
    switch node.Kind {
    case shimast.KindIdentifier:
      return identifierText(node)
    case shimast.KindPropertyAccessExpression:
      access := node.AsPropertyAccessExpression()
      if access == nil {
        return ""
      }
      node = stripParens(access.Expression)
    case shimast.KindElementAccessExpression:
      access := node.AsElementAccessExpression()
      if access == nil {
        return ""
      }
      node = stripParens(access.Expression)
    default:
      return ""
    }
  }
  return ""
}

func parameterName(node *shimast.Node) string {
  if node == nil {
    return ""
  }
  param := node.AsParameterDeclaration()
  if param == nil {
    return ""
  }
  return identifierText(param.Name())
}

func formatQuotedList(names []string) string {
  quoted := make([]string, len(names))
  for i, name := range names {
    quoted[i] = fmt.Sprintf("%q", name)
  }
  return strings.Join(quoted, ", ")
}

func init() {
  Register(reactHooksRule{name: "react-hooks/rules-of-hooks"})
  Register(reactHooksRule{name: "react-hooks/exhaustive-deps"})
  Register(reactHooksRule{name: "react-hooks/component-hook-factories"})
  Register(reactHooksRule{name: "react-hooks/set-state-in-render"})
  Register(reactHooksRule{name: "react-hooks/set-state-in-effect"})
  Register(reactHooksRule{name: "react-hooks/immutability"})
  Register(reactHooksRule{name: "react-hooks/refs"})
  Register(reactHooksRule{name: "react-hooks/use-memo"})
}
