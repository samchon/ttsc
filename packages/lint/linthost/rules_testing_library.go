package linthost

import (
  "encoding/json"
  "path/filepath"
  "regexp"
  "strings"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

type testingLibraryRule struct {
  name string
}

func (r testingLibraryRule) Name() string { return "testing-library/" + r.name }
func (r testingLibraryRule) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindSourceFile}
}
func (r testingLibraryRule) Check(ctx *Context, node *shimast.Node) {
  state := collectTestingLibraryState(ctx)
  if !state.hasTestingLibrary && r.name != "no-dom-import" {
    return
  }
  switch r.name {
  case "await-async-events":
    state.reportUnhandledAsyncEvents(ctx)
  case "await-async-queries":
    state.reportUnhandledAsyncQueries(ctx)
  case "await-async-utils":
    state.reportUnhandledAsyncUtils(ctx)
  case "consistent-data-testid":
    state.reportInconsistentDataTestIDs(ctx)
  case "no-await-sync-events":
    state.reportAwaitedSyncEvents(ctx)
  case "no-await-sync-queries":
    state.reportAwaitedSyncQueries(ctx)
  case "no-container":
    state.reportContainerAccess(ctx)
  case "no-debugging-utils":
    state.reportDebuggingUtils(ctx)
  case "no-dom-import":
    state.reportDOMImports(ctx)
  case "no-global-regexp-flag-in-query":
    state.reportGlobalRegexQueries(ctx)
  case "no-manual-cleanup":
    state.reportManualCleanup(ctx)
  case "no-node-access":
    state.reportNodeAccess(ctx)
  case "no-promise-in-fire-event":
    state.reportPromiseInFireEvent(ctx)
  case "no-render-in-lifecycle":
    state.reportRenderInLifecycle(ctx)
  case "no-test-id-queries":
    state.reportTestIDQueries(ctx)
  case "no-unnecessary-act":
    state.reportUnnecessaryAct(ctx)
  case "no-wait-for-multiple-assertions":
    state.reportWaitForMultipleAssertions(ctx)
  case "no-wait-for-side-effects":
    state.reportWaitForSideEffects(ctx)
  case "no-wait-for-snapshot":
    state.reportWaitForSnapshot(ctx)
  case "prefer-explicit-assert":
    state.reportPreferExplicitAssert(ctx)
  case "prefer-find-by":
    state.reportPreferFindBy(ctx)
  case "prefer-implicit-assert":
    state.reportPreferImplicitAssert(ctx)
  case "prefer-presence-queries":
    state.reportPreferPresenceQueries(ctx)
  case "prefer-query-by-disappearance":
    state.reportPreferQueryByDisappearance(ctx)
  case "prefer-query-matchers":
    state.reportPreferQueryMatchers(ctx)
  case "prefer-screen-queries":
    state.reportPreferScreenQueries(ctx)
  case "prefer-user-event":
    state.reportPreferUserEvent(ctx)
  case "prefer-user-event-setup":
    state.reportPreferUserEventSetup(ctx)
  case "render-result-naming-convention":
    state.reportRenderResultNames(ctx)
  }
}

type testingLibraryState struct {
  hasTestingLibrary bool

  imports          []*shimast.Node
  calls            []*shimast.Node
  propertyAccesses []*shimast.Node
  variables        []*shimast.Node
  bindingElements  []*shimast.Node
  jsxAttributes    []*shimast.Node

  imported         map[string]string
  screenNames      map[string]bool
  fireEventNames   map[string]bool
  userEventNames   map[string]bool
  userEventSetups  map[string]bool
  renderNames      map[string]bool
  cleanupNames     map[string]bool
  asyncUtilNames   map[string]bool
  renderResultVars map[string]bool
  containerNames   map[string]bool
  renderQueries    map[string]bool
}

func collectTestingLibraryState(ctx *Context) *testingLibraryState {
  state := &testingLibraryState{
    imported:         map[string]string{},
    screenNames:      map[string]bool{},
    fireEventNames:   map[string]bool{},
    userEventNames:   map[string]bool{},
    userEventSetups:  map[string]bool{},
    renderNames:      map[string]bool{},
    cleanupNames:     map[string]bool{},
    asyncUtilNames:   map[string]bool{},
    renderResultVars: map[string]bool{},
    containerNames:   map[string]bool{},
    renderQueries:    map[string]bool{},
  }
  if ctx == nil || ctx.File == nil {
    return state
  }
  for _, stmt := range ctx.File.Statements.Nodes {
    if stmt == nil || stmt.Kind != shimast.KindImportDeclaration {
      continue
    }
    state.imports = append(state.imports, stmt)
    state.collectImport(stmt)
  }
  walkDescendants(ctx.File.AsNode(), func(child *shimast.Node) {
    if child == nil {
      return
    }
    switch child.Kind {
    case shimast.KindCallExpression:
      state.calls = append(state.calls, child)
    case shimast.KindPropertyAccessExpression:
      state.propertyAccesses = append(state.propertyAccesses, child)
    case shimast.KindVariableDeclaration:
      state.variables = append(state.variables, child)
      state.collectVariable(child)
    case shimast.KindBindingElement:
      state.bindingElements = append(state.bindingElements, child)
    case shimast.KindJsxAttribute:
      state.jsxAttributes = append(state.jsxAttributes, child)
    }
  })
  return state
}

func (s *testingLibraryState) collectImport(node *shimast.Node) {
  decl := node.AsImportDeclaration()
  if decl == nil {
    return
  }
  module := stringLiteralText(decl.ModuleSpecifier)
  if module == "" {
    return
  }
  fromTestingLibrary := strings.HasPrefix(module, "@testing-library/")
  if fromTestingLibrary {
    s.hasTestingLibrary = true
  }
  if !fromTestingLibrary || decl.ImportClause == nil {
    return
  }
  clause := decl.ImportClause.AsImportClause()
  if clause == nil {
    return
  }
  if name := identifierText(clause.Name()); name != "" {
    if strings.Contains(module, "user-event") {
      s.userEventNames[name] = true
    }
    s.imported[name] = "default"
  }
  bindings := clause.NamedBindings
  if bindings == nil {
    return
  }
  switch bindings.Kind {
  case shimast.KindNamedImports:
    named := bindings.AsNamedImports()
    if named == nil || named.Elements == nil {
      return
    }
    for _, specNode := range named.Elements.Nodes {
      spec := specNode.AsImportSpecifier()
      if spec == nil {
        continue
      }
      imported := moduleExportNameText(spec.PropertyName)
      local := identifierText(spec.Name())
      if imported == "" {
        imported = local
      }
      if local == "" {
        continue
      }
      s.imported[local] = imported
      s.markTestingLibraryName(local, imported)
    }
  case shimast.KindNamespaceImport:
    ns := bindings.AsNamespaceImport()
    if ns == nil {
      return
    }
    local := identifierText(ns.Name())
    if local != "" {
      s.imported[local] = "*"
    }
  }
}

func (s *testingLibraryState) markTestingLibraryName(local, imported string) {
  switch imported {
  case "screen":
    s.screenNames[local] = true
  case "fireEvent":
    s.fireEventNames[local] = true
  case "userEvent":
    s.userEventNames[local] = true
  case "render":
    s.renderNames[local] = true
  case "cleanup":
    s.cleanupNames[local] = true
  case "waitFor", "waitForElementToBeRemoved":
    s.asyncUtilNames[local] = true
  }
  if isTestingLibraryQueryName(imported) {
    s.renderQueries[local] = true
  }
}

func (s *testingLibraryState) collectVariable(node *shimast.Node) {
  decl := node.AsVariableDeclaration()
  if decl == nil {
    return
  }
  init := stripParens(decl.Initializer)
  name := decl.Name()
  if local := identifierText(name); local != "" {
    if s.isRenderCall(init) {
      s.renderResultVars[local] = true
    }
    if s.isUserEventSetupCall(init) {
      s.userEventSetups[local] = true
    }
  }
  if name == nil || name.Kind != shimast.KindObjectBindingPattern || !s.isRenderCall(init) {
    return
  }
  binding := name.AsBindingPattern()
  if binding == nil || binding.Elements == nil {
    return
  }
  for _, elementNode := range binding.Elements.Nodes {
    el := elementNode.AsBindingElement()
    if el == nil {
      continue
    }
    imported := moduleExportNameText(el.PropertyName)
    local := identifierText(el.Name())
    if imported == "" {
      imported = local
    }
    if local == "" {
      continue
    }
    if imported == "container" {
      s.containerNames[local] = true
    }
    if isTestingLibraryQueryName(imported) || imported == "debug" {
      s.renderQueries[local] = true
    }
  }
}

func (s *testingLibraryState) reportUnhandledAsyncQueries(ctx *Context) {
  for _, node := range s.calls {
    call := node.AsCallExpression()
    if call == nil || !s.isQueryCall(call, queryAsync) || isPromiseHandled(node) {
      continue
    }
    ctx.Report(node, "Handle the Promise returned by async Testing Library queries.")
  }
}

func (s *testingLibraryState) reportUnhandledAsyncEvents(ctx *Context) {
  for _, node := range s.calls {
    call := node.AsCallExpression()
    if call == nil || !s.isUserEventCall(call) || isPromiseHandled(node) {
      continue
    }
    ctx.Report(node, "Handle the Promise returned by async user-event methods.")
  }
}

func (s *testingLibraryState) reportUnhandledAsyncUtils(ctx *Context) {
  for _, node := range s.calls {
    call := node.AsCallExpression()
    if call == nil || !s.isAsyncUtilCall(call) || isPromiseHandled(node) {
      continue
    }
    ctx.Report(node, "Handle the Promise returned by async Testing Library utilities.")
  }
}

func (s *testingLibraryState) reportAwaitedSyncEvents(ctx *Context) {
  for _, node := range s.calls {
    call := node.AsCallExpression()
    if call == nil || !s.isFireEventCall(call) || !isDirectlyAwaited(node) {
      continue
    }
    ctx.Report(node, "Do not await synchronous fireEvent calls.")
  }
}

func (s *testingLibraryState) reportAwaitedSyncQueries(ctx *Context) {
  for _, node := range s.calls {
    call := node.AsCallExpression()
    if call == nil || !s.isQueryCall(call, querySync) || !isDirectlyAwaited(node) {
      continue
    }
    ctx.Report(node, "Do not await synchronous Testing Library queries.")
  }
}

func (s *testingLibraryState) reportContainerAccess(ctx *Context) {
  for _, node := range s.bindingElements {
    if s.isRenderContainerBinding(node) {
      ctx.Report(node, "Avoid destructuring `container`; prefer Testing Library queries.")
    }
  }
  for _, node := range s.calls {
    call := node.AsCallExpression()
    info := callInfoFromCall(call)
    if info.name == "" || !s.containerNames[info.receiver] || !isContainerMethod(info.name) {
      continue
    }
    ctx.Report(node, "Avoid querying through `container`; use screen queries instead.")
  }
}

func (s *testingLibraryState) isRenderContainerBinding(node *shimast.Node) bool {
  el := node.AsBindingElement()
  if el == nil {
    return false
  }
  imported := moduleExportNameText(el.PropertyName)
  local := identifierText(el.Name())
  if imported == "" {
    imported = local
  }
  if imported != "container" {
    return false
  }
  for cur := node.Parent; cur != nil; cur = cur.Parent {
    if cur.Kind != shimast.KindVariableDeclaration {
      continue
    }
    decl := cur.AsVariableDeclaration()
    return decl != nil && s.isRenderCall(stripParens(decl.Initializer))
  }
  return false
}

func (s *testingLibraryState) reportDebuggingUtils(ctx *Context) {
  for _, node := range s.calls {
    call := node.AsCallExpression()
    info := callInfoFromCall(call)
    if info.name == "" {
      continue
    }
    if isDebugUtility(info.name) && (info.receiver == "" || s.screenNames[info.receiver] || s.renderQueries[info.receiver]) {
      ctx.Report(node, "Remove Testing Library debugging utilities from committed tests.")
    }
  }
}

func (s *testingLibraryState) reportDOMImports(ctx *Context) {
  for _, node := range s.imports {
    decl := node.AsImportDeclaration()
    if decl == nil || stringLiteralText(decl.ModuleSpecifier) != "@testing-library/dom" {
      continue
    }
    ctx.Report(node, "Import from the framework Testing Library package instead of @testing-library/dom.")
  }
}

func (s *testingLibraryState) reportGlobalRegexQueries(ctx *Context) {
  for _, node := range s.calls {
    call := node.AsCallExpression()
    if call == nil || !s.isQueryCall(call, queryAny) || call.Arguments == nil {
      continue
    }
    for _, arg := range call.Arguments.Nodes {
      if arg != nil && arg.Kind == shimast.KindRegularExpressionLiteral && regexLiteralHasGlobalFlag(ctx.File, arg) {
        ctx.Report(arg, "Do not use the global RegExp flag in Testing Library queries.")
      }
    }
  }
}

func (s *testingLibraryState) reportManualCleanup(ctx *Context) {
  for _, node := range s.calls {
    call := node.AsCallExpression()
    if call == nil {
      continue
    }
    info := callInfoFromCall(call)
    if s.cleanupNames[info.name] {
      ctx.Report(node, "Testing Library cleanup is automatic; remove manual cleanup().")
    }
  }
}

func (s *testingLibraryState) reportNodeAccess(ctx *Context) {
  for _, node := range s.propertyAccesses {
    access := node.AsPropertyAccessExpression()
    if access == nil {
      continue
    }
    name := identifierText(access.Name())
    if !isNodeAccessName(name) {
      continue
    }
    receiver := stripParens(access.Expression)
    if receiver == nil {
      continue
    }
    if s.containerNames[identifierText(receiver)] || s.isQueryExpression(receiver) {
      ctx.Report(node, "Avoid direct DOM node access; use Testing Library queries and matchers.")
    }
  }
}

func (s *testingLibraryState) reportPromiseInFireEvent(ctx *Context) {
  for _, node := range s.calls {
    call := node.AsCallExpression()
    if call == nil || !s.isFireEventCall(call) || call.Arguments == nil {
      continue
    }
    for _, arg := range call.Arguments.Nodes {
      if containsNode(arg, func(child *shimast.Node) bool {
        if child == nil {
          return false
        }
        if child.Kind == shimast.KindAwaitExpression {
          return true
        }
        inner := child.AsCallExpression()
        return inner != nil && (s.isQueryCall(inner, queryAsync) || s.isAsyncUtilCall(inner) || s.isUserEventCall(inner))
      }) {
        ctx.Report(node, "Do not pass Promises or async Testing Library calls to fireEvent.")
        break
      }
    }
  }
}

func (s *testingLibraryState) reportRenderInLifecycle(ctx *Context) {
  for _, node := range s.calls {
    call := node.AsCallExpression()
    if call == nil || !s.isRenderCall(node) || !isInsideLifecycleCallback(node) {
      continue
    }
    ctx.Report(node, "Do not call render inside test lifecycle hooks.")
  }
}

func (s *testingLibraryState) reportTestIDQueries(ctx *Context) {
  for _, node := range s.calls {
    call := node.AsCallExpression()
    if call == nil {
      continue
    }
    info := callInfoFromCall(call)
    if strings.Contains(info.name, "ByTestId") && s.isQueryCall(call, queryAny) {
      ctx.Report(node, "Avoid Testing Library test-id queries when accessible queries are possible.")
    }
  }
}

func (s *testingLibraryState) reportUnnecessaryAct(ctx *Context) {
  for _, node := range s.calls {
    call := node.AsCallExpression()
    if call == nil || callInfoFromCall(call).name != "act" || call.Arguments == nil || len(call.Arguments.Nodes) == 0 {
      continue
    }
    callback := call.Arguments.Nodes[0]
    if containsNode(callback, func(child *shimast.Node) bool {
      inner := child.AsCallExpression()
      return inner != nil && (s.isRenderCall(child) || s.isFireEventCall(inner) || s.isUserEventCall(inner))
    }) {
      reportTestingLibraryCallName(ctx, node, "act", "Testing Library already wraps these updates in act().")
    }
  }
}

func (s *testingLibraryState) reportWaitForMultipleAssertions(ctx *Context) {
  s.forEachWaitFor(func(_, body *shimast.Node) {
    count := countCalls(body, func(call *shimast.CallExpression) bool {
      return callInfoFromCall(call).name == "expect"
    })
    if count > 1 {
      reportTestingLibraryCallBefore(ctx, body, "waitFor", "Keep only one assertion inside waitFor().")
    }
  })
}

func (s *testingLibraryState) reportWaitForSideEffects(ctx *Context) {
  s.forEachWaitFor(func(_, body *shimast.Node) {
    if containsNode(body, func(child *shimast.Node) bool {
      call := child.AsCallExpression()
      if call == nil {
        return false
      }
      return s.isFireEventCall(call) || s.isUserEventCall(call) || s.isRenderCall(child)
    }) {
      reportTestingLibraryCallBefore(ctx, body, "waitFor", "Do not run side effects inside waitFor().")
    }
  })
}

func (s *testingLibraryState) reportWaitForSnapshot(ctx *Context) {
  s.forEachWaitFor(func(_, body *shimast.Node) {
    if containsCall(body, func(call *shimast.CallExpression) bool {
      name := callInfoFromCall(call).name
      return name == "toMatchSnapshot" || name == "toMatchInlineSnapshot"
    }) {
      reportTestingLibraryCallBefore(ctx, body, "waitFor", "Do not create snapshots inside waitFor().")
    }
  })
}

func (s *testingLibraryState) reportPreferFindBy(ctx *Context) {
  s.forEachWaitFor(func(_, body *shimast.Node) {
    if containsCall(body, func(call *shimast.CallExpression) bool {
      return s.isQueryCall(call, queryGet)
    }) {
      reportTestingLibraryCallBefore(ctx, body, "waitFor", "Use findBy* queries instead of waitFor() around getBy* queries.")
    }
  })
}

func (s *testingLibraryState) reportPreferExplicitAssert(ctx *Context) {
  for _, node := range s.calls {
    call := node.AsCallExpression()
    if call == nil || !s.isQueryCall(call, queryGet|queryAsync) {
      continue
    }
    if parent := nearestNonQueryParent(node); parent != nil && parent.Kind == shimast.KindExpressionStatement {
      ctx.Report(node, "Wrap standalone Testing Library queries in an explicit assertion.")
    }
  }
}

func (s *testingLibraryState) reportPreferImplicitAssert(ctx *Context) {
  for _, node := range s.calls {
    call := node.AsCallExpression()
    info := callInfoFromCall(call)
    if info.name != "toBeInTheDocument" || !isExpectMatcherCall(node) {
      continue
    }
    expectArg := firstExpectArgument(node)
    if expectArg != nil {
      inner := expectArg.AsCallExpression()
      if inner != nil && s.isQueryCall(inner, queryGet|queryAsync) {
        ctx.Report(node, "Prefer the implicit assertion from getBy* or findBy* queries.")
      }
    }
  }
}

func (s *testingLibraryState) reportPreferPresenceQueries(ctx *Context) {
  for _, node := range s.calls {
    call := node.AsCallExpression()
    info := callInfoFromCall(call)
    if info.name != "toBeInTheDocument" || !isExpectMatcherCall(node) {
      continue
    }
    expectArg := firstExpectArgument(node)
    if expectArg == nil {
      continue
    }
    inner := expectArg.AsCallExpression()
    if inner == nil {
      continue
    }
    negated := matcherCallIsNegated(node)
    if !negated && s.isQueryCall(inner, queryQuery) {
      ctx.Report(expectArg, "Use getBy* queries for presence assertions.")
    }
    if negated && s.isQueryCall(inner, queryGet) {
      ctx.Report(expectArg, "Use queryBy* queries for absence assertions.")
    }
  }
}

func (s *testingLibraryState) reportPreferQueryByDisappearance(ctx *Context) {
  s.forEachWaitFor(func(_, body *shimast.Node) {
    if containsNode(body, func(child *shimast.Node) bool {
      call := child.AsCallExpression()
      if call == nil {
        return false
      }
      info := callInfoFromCall(call)
      if info.name != "toBeInTheDocument" {
        return false
      }
      arg := firstExpectArgument(child)
      if arg == nil {
        return false
      }
      inner := arg.AsCallExpression()
      return matcherCallIsNegated(child) && inner != nil && s.isQueryCall(inner, queryGet|queryAsync)
    }) {
      reportTestingLibraryCallBefore(ctx, body, "waitFor", "Use queryBy* queries when waiting for disappearance.")
    }
  })
}

func (s *testingLibraryState) reportPreferQueryMatchers(ctx *Context) {
  for _, node := range s.calls {
    call := node.AsCallExpression()
    info := callInfoFromCall(call)
    if info.name != "toBeNull" && info.name != "toBeTruthy" && info.name != "toBeFalsy" {
      continue
    }
    arg := firstExpectArgument(node)
    if arg == nil {
      continue
    }
    inner := arg.AsCallExpression()
    if inner != nil && s.isQueryCall(inner, queryAny) {
      ctx.Report(node, "Use jest-dom document matchers with Testing Library queries.")
    }
  }
}

func (s *testingLibraryState) reportPreferScreenQueries(ctx *Context) {
  for _, node := range s.calls {
    call := node.AsCallExpression()
    if call == nil {
      continue
    }
    info := callInfoFromCall(call)
    if s.renderQueries[info.name] && isTestingLibraryQueryName(info.name) {
      ctx.Report(node, "Use screen.* queries instead of destructured render queries.")
    }
    if s.renderResultVars[info.receiver] && isTestingLibraryQueryName(info.name) {
      ctx.Report(node, "Use screen.* queries instead of render result queries.")
    }
  }
}

func (s *testingLibraryState) reportPreferUserEvent(ctx *Context) {
  for _, node := range s.calls {
    call := node.AsCallExpression()
    if call != nil && s.isFireEventCall(call) {
      ctx.Report(node, "Use userEvent instead of fireEvent for user interactions.")
    }
  }
}

func (s *testingLibraryState) reportPreferUserEventSetup(ctx *Context) {
  for _, node := range s.calls {
    call := node.AsCallExpression()
    if call == nil || !s.isUserEventCall(call) {
      continue
    }
    info := callInfoFromCall(call)
    if !s.userEventSetups[info.receiver] {
      ctx.Report(node, "Use userEvent.setup() and call methods on the returned user object.")
    }
  }
}

func (s *testingLibraryState) reportRenderResultNames(ctx *Context) {
  for _, node := range s.variables {
    decl := node.AsVariableDeclaration()
    if decl == nil || !s.isRenderCall(stripParens(decl.Initializer)) {
      continue
    }
    name := identifierText(decl.Name())
    if name == "" || name == "view" || name == "utils" || name == "renderResult" {
      continue
    }
    ctx.Report(decl.Name(), "Name render() results `view`, `utils`, or destructure the needed queries.")
  }
}

func (s *testingLibraryState) reportInconsistentDataTestIDs(ctx *Context) {
  var opts testingLibraryConsistentDataTestIDOptions
  if err := ctx.DecodeOptions(&opts); err != nil || opts.TestIDPattern == "" {
    return
  }
  pattern := strings.ReplaceAll(opts.TestIDPattern, "{fileName}", testingLibraryFileName(ctx.File.FileName()))
  re, err := regexp.Compile(pattern)
  if err != nil {
    return
  }
  attrs := opts.testIDAttributes()
  for _, node := range s.jsxAttributes {
    attr := node.AsJsxAttribute()
    if attr == nil || !attrs[identifierText(attr.Name())] || attr.Initializer == nil {
      continue
    }
    value := stringLiteralText(attr.Initializer)
    if value != "" && !re.MatchString(value) {
      ctx.Report(node, "`data-testid` value does not match the configured pattern.")
    }
  }
}

type testingLibraryConsistentDataTestIDOptions struct {
  TestIDPattern   string          `json:"testIdPattern"`
  TestIDAttribute json.RawMessage `json:"testIdAttribute"`
}

func (o testingLibraryConsistentDataTestIDOptions) testIDAttributes() map[string]bool {
  if len(o.TestIDAttribute) == 0 {
    return map[string]bool{"data-testid": true}
  }
  var single string
  if json.Unmarshal(o.TestIDAttribute, &single) == nil && single != "" {
    return map[string]bool{single: true}
  }
  var list []string
  attrs := map[string]bool{}
  if json.Unmarshal(o.TestIDAttribute, &list) == nil {
    for _, attr := range list {
      if attr != "" {
        attrs[attr] = true
      }
    }
  }
  if len(attrs) == 0 {
    attrs["data-testid"] = true
  }
  return attrs
}

func (s *testingLibraryState) forEachWaitFor(visit func(_, body *shimast.Node)) {
  for _, node := range s.calls {
    call := node.AsCallExpression()
    if call == nil || !s.isWaitForCall(call) || call.Arguments == nil || len(call.Arguments.Nodes) == 0 {
      continue
    }
    body := functionBody(call.Arguments.Nodes[0])
    if body != nil {
      visit(node, body)
    }
  }
}

type testingLibraryQueryKind int

const (
  queryGet testingLibraryQueryKind = 1 << iota
  queryQuery
  queryAsync
  queryAny  = queryGet | queryQuery | queryAsync
  querySync = queryGet | queryQuery
)

func (s *testingLibraryState) isQueryCall(call *shimast.CallExpression, kinds testingLibraryQueryKind) bool {
  info := callInfoFromCall(call)
  if !isTestingLibraryQueryName(info.name) {
    return false
  }
  if info.receiver != "" && !s.screenNames[info.receiver] && !s.renderResultVars[info.receiver] {
    return false
  }
  if info.receiver == "" && !s.renderQueries[info.name] && s.imported[info.name] == "" {
    return false
  }
  if strings.HasPrefix(info.name, "getBy") || strings.HasPrefix(info.name, "getAllBy") {
    return kinds&queryGet != 0
  }
  if strings.HasPrefix(info.name, "queryBy") || strings.HasPrefix(info.name, "queryAllBy") {
    return kinds&queryQuery != 0
  }
  if strings.HasPrefix(info.name, "findBy") || strings.HasPrefix(info.name, "findAllBy") {
    return kinds&queryAsync != 0
  }
  return false
}

func (s *testingLibraryState) isQueryExpression(node *shimast.Node) bool {
  node = stripParens(node)
  if node == nil || node.Kind != shimast.KindCallExpression {
    return false
  }
  call := node.AsCallExpression()
  return s.isQueryCall(call, queryAny)
}

func (s *testingLibraryState) isFireEventCall(call *shimast.CallExpression) bool {
  info := callInfoFromCall(call)
  return info.receiver != "" && s.fireEventNames[info.receiver]
}

func (s *testingLibraryState) isUserEventCall(call *shimast.CallExpression) bool {
  info := callInfoFromCall(call)
  return info.receiver != "" && info.name != "setup" && (s.userEventNames[info.receiver] || s.userEventSetups[info.receiver])
}

func (s *testingLibraryState) isUserEventSetupCall(node *shimast.Node) bool {
  node = stripParens(node)
  if node == nil || node.Kind != shimast.KindCallExpression {
    return false
  }
  call := node.AsCallExpression()
  info := callInfoFromCall(call)
  return info.name == "setup" && s.userEventNames[info.receiver]
}

func (s *testingLibraryState) isAsyncUtilCall(call *shimast.CallExpression) bool {
  info := callInfoFromCall(call)
  return s.asyncUtilNames[info.name]
}

func (s *testingLibraryState) isWaitForCall(call *shimast.CallExpression) bool {
  return callInfoFromCall(call).name == "waitFor" && s.isAsyncUtilCall(call)
}

func (s *testingLibraryState) isRenderCall(node *shimast.Node) bool {
  node = stripParens(node)
  if node == nil || node.Kind != shimast.KindCallExpression {
    return false
  }
  call := node.AsCallExpression()
  info := callInfoFromCall(call)
  return s.renderNames[info.name]
}

type testingLibraryCallInfo struct {
  name     string
  receiver string
}

func callInfoFromCall(call *shimast.CallExpression) testingLibraryCallInfo {
  if call == nil {
    return testingLibraryCallInfo{}
  }
  expr := stripParens(call.Expression)
  if expr == nil {
    return testingLibraryCallInfo{}
  }
  if expr.Kind == shimast.KindPropertyAccessExpression {
    access := expr.AsPropertyAccessExpression()
    return testingLibraryCallInfo{
      name:     identifierText(access.Name()),
      receiver: receiverName(access.Expression),
    }
  }
  return testingLibraryCallInfo{name: identifierText(expr)}
}

func receiverName(node *shimast.Node) string {
  node = stripParens(node)
  if node == nil {
    return ""
  }
  if name := identifierText(node); name != "" {
    return name
  }
  if node.Kind == shimast.KindPropertyAccessExpression {
    access := node.AsPropertyAccessExpression()
    return identifierText(access.Name())
  }
  return ""
}

func moduleExportNameText(node *shimast.Node) string {
  if node == nil {
    return ""
  }
  if text := identifierText(node); text != "" {
    return text
  }
  return stringLiteralText(node)
}

func isTestingLibraryQueryName(name string) bool {
  return strings.HasPrefix(name, "getBy") ||
    strings.HasPrefix(name, "getAllBy") ||
    strings.HasPrefix(name, "queryBy") ||
    strings.HasPrefix(name, "queryAllBy") ||
    strings.HasPrefix(name, "findBy") ||
    strings.HasPrefix(name, "findAllBy")
}

func isContainerMethod(name string) bool {
  switch name {
  case "querySelector", "querySelectorAll", "getElementsByClassName", "getElementsByTagName", "getElementById":
    return true
  }
  return false
}

func isNodeAccessName(name string) bool {
  switch name {
  case "closest", "children", "childNodes", "firstChild", "firstElementChild", "lastChild", "lastElementChild",
    "nextSibling", "nextElementSibling", "parentElement", "parentNode", "previousSibling", "previousElementSibling",
    "querySelector", "querySelectorAll":
    return true
  }
  return false
}

func isDebugUtility(name string) bool {
  switch name {
  case "debug", "prettyDOM", "logRoles", "logTestingPlaygroundURL":
    return true
  }
  return false
}

func isPromiseHandled(node *shimast.Node) bool {
  for cur := node.Parent; cur != nil; cur = cur.Parent {
    switch cur.Kind {
    case shimast.KindParenthesizedExpression, shimast.KindPropertyAccessExpression, shimast.KindCallExpression:
      continue
    case shimast.KindAwaitExpression, shimast.KindReturnStatement:
      return true
    default:
      return false
    }
  }
  return false
}

func isDirectlyAwaited(node *shimast.Node) bool {
  for cur := node.Parent; cur != nil; cur = cur.Parent {
    if cur.Kind == shimast.KindParenthesizedExpression {
      continue
    }
    return cur.Kind == shimast.KindAwaitExpression
  }
  return false
}

func containsNode(node *shimast.Node, match func(*shimast.Node) bool) bool {
  if node == nil {
    return false
  }
  found := false
  walkDescendants(node, func(child *shimast.Node) {
    if found {
      return
    }
    if match(child) {
      found = true
    }
  })
  return found
}

func containsCall(node *shimast.Node, match func(*shimast.CallExpression) bool) bool {
  return containsNode(node, func(child *shimast.Node) bool {
    call := child.AsCallExpression()
    return call != nil && match(call)
  })
}

func countCalls(node *shimast.Node, match func(*shimast.CallExpression) bool) int {
  count := 0
  walkDescendants(node, func(child *shimast.Node) {
    call := child.AsCallExpression()
    if call != nil && match(call) {
      count++
    }
  })
  return count
}

func functionBody(node *shimast.Node) *shimast.Node {
  node = stripParens(node)
  if node == nil {
    return nil
  }
  switch node.Kind {
  case shimast.KindArrowFunction, shimast.KindFunctionExpression:
    return node.Body()
  }
  return nil
}

func isInsideLifecycleCallback(node *shimast.Node) bool {
  for cur := node.Parent; cur != nil; cur = cur.Parent {
    if cur.Kind != shimast.KindArrowFunction && cur.Kind != shimast.KindFunctionExpression {
      continue
    }
    parent := cur.Parent
    if parent == nil || parent.Kind != shimast.KindCallExpression {
      continue
    }
    call := parent.AsCallExpression()
    switch callInfoFromCall(call).name {
    case "beforeEach", "beforeAll", "afterEach", "afterAll":
      return true
    }
  }
  return false
}

func regexLiteralHasGlobalFlag(file *shimast.SourceFile, node *shimast.Node) bool {
  text := nodeText(file, node)
  slash := strings.LastIndexByte(text, '/')
  return slash >= 0 && strings.Contains(text[slash+1:], "g")
}

func reportTestingLibraryCallName(ctx *Context, node *shimast.Node, name, message string) {
  if ctx == nil || ctx.File == nil || node == nil {
    return
  }
  call := node.AsCallExpression()
  if call != nil && call.Expression != nil {
    ctx.Report(call.Expression, message)
    return
  }
  ctx.Report(node, message)
}

func reportTestingLibraryCallBefore(ctx *Context, anchor *shimast.Node, name, message string) {
  if ctx == nil || ctx.File == nil || anchor == nil {
    return
  }
  src := ctx.File.Text()
  end := anchor.Pos()
  if end > len(src) {
    end = len(src)
  }
  if end <= 0 {
    end = len(src)
  }
  idx := strings.LastIndex(src[:end], name)
  if idx < 0 {
    ctx.Report(anchor, message)
    return
  }
  ctx.ReportRange(idx, idx+len(name), message)
}

func nearestNonQueryParent(node *shimast.Node) *shimast.Node {
  for cur := node.Parent; cur != nil; cur = cur.Parent {
    if cur.Kind == shimast.KindParenthesizedExpression || cur.Kind == shimast.KindPropertyAccessExpression {
      continue
    }
    return cur
  }
  return nil
}

func isExpectMatcherCall(node *shimast.Node) bool {
  return expectCallFromMatcherNode(node) != nil
}

func firstExpectArgument(node *shimast.Node) *shimast.Node {
  call := expectCallFromMatcherNode(node)
  if call != nil && call.Arguments != nil && len(call.Arguments.Nodes) > 0 {
    return stripParens(call.Arguments.Nodes[0])
  }
  return nil
}

func expectCallFromMatcherNode(node *shimast.Node) *shimast.CallExpression {
  if call := expectCallInExpression(node); call != nil {
    return call
  }
  for cur := node; cur != nil; cur = cur.Parent {
    call := cur.AsCallExpression()
    if call == nil || callInfoFromCall(call).name != "expect" || call.Arguments == nil || len(call.Arguments.Nodes) == 0 {
      continue
    }
    return call
  }
  return nil
}

func expectCallInExpression(node *shimast.Node) *shimast.CallExpression {
  node = stripParens(node)
  if node == nil {
    return nil
  }
  switch node.Kind {
  case shimast.KindCallExpression:
    call := node.AsCallExpression()
    if callInfoFromCall(call).name == "expect" {
      return call
    }
    return expectCallInExpression(call.Expression)
  case shimast.KindPropertyAccessExpression:
    access := node.AsPropertyAccessExpression()
    if access == nil {
      return nil
    }
    return expectCallInExpression(access.Expression)
  }
  return nil
}

func matcherCallIsNegated(node *shimast.Node) bool {
  if matcherExpressionHasProperty(node, "not") {
    return true
  }
  for cur := node.Parent; cur != nil; cur = cur.Parent {
    if cur.Kind != shimast.KindPropertyAccessExpression {
      continue
    }
    if identifierText(cur.AsPropertyAccessExpression().Name()) == "not" {
      return true
    }
  }
  return false
}

func matcherExpressionHasProperty(node *shimast.Node, name string) bool {
  node = stripParens(node)
  if node == nil {
    return false
  }
  switch node.Kind {
  case shimast.KindCallExpression:
    call := node.AsCallExpression()
    return call != nil && matcherExpressionHasProperty(call.Expression, name)
  case shimast.KindPropertyAccessExpression:
    access := node.AsPropertyAccessExpression()
    if access == nil {
      return false
    }
    if identifierText(access.Name()) == name {
      return true
    }
    return matcherExpressionHasProperty(access.Expression, name)
  }
  return false
}

func testingLibraryFileName(fileName string) string {
  base := filepath.Base(fileName)
  if dot := strings.IndexByte(base, '.'); dot > 0 {
    return base[:dot]
  }
  return base
}

func init() {
  for _, name := range []string{
    "await-async-events",
    "await-async-queries",
    "await-async-utils",
    "consistent-data-testid",
    "no-await-sync-events",
    "no-await-sync-queries",
    "no-container",
    "no-debugging-utils",
    "no-dom-import",
    "no-global-regexp-flag-in-query",
    "no-manual-cleanup",
    "no-node-access",
    "no-promise-in-fire-event",
    "no-render-in-lifecycle",
    "no-test-id-queries",
    "no-unnecessary-act",
    "no-wait-for-multiple-assertions",
    "no-wait-for-side-effects",
    "no-wait-for-snapshot",
    "prefer-explicit-assert",
    "prefer-find-by",
    "prefer-implicit-assert",
    "prefer-presence-queries",
    "prefer-query-by-disappearance",
    "prefer-query-matchers",
    "prefer-screen-queries",
    "prefer-user-event",
    "prefer-user-event-setup",
    "render-result-naming-convention",
  } {
    Register(testingLibraryRule{name: name})
  }
}
