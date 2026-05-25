package linthost

import (
  "strings"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

type solidRule struct {
  name string
}

func (r solidRule) Name() string { return "solid/" + r.name }
func (r solidRule) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindSourceFile}
}
func (r solidRule) Check(ctx *Context, node *shimast.Node) {
  if r.name == "jsx-uses-vars" {
    return
  }
  state := collectSolidState(ctx)
  if !state.hasSolid && r.name != "jsx-no-undef" {
    return
  }
  switch r.name {
  case "components-return-once":
    state.reportComponentsReturnOnce(ctx)
  case "event-handlers":
    state.reportEventHandlers(ctx)
  case "imports":
    state.reportImports(ctx)
  case "jsx-no-duplicate-props":
    state.reportDuplicateProps(ctx)
  case "jsx-no-script-url":
    state.reportScriptURLs(ctx)
  case "jsx-no-undef":
    state.reportJSXNoUndef(ctx)
  case "no-array-handlers":
    state.reportArrayHandlers(ctx)
  case "no-destructure":
    state.reportNoDestructure(ctx)
  case "no-innerhtml":
    state.reportInnerHTML(ctx)
  case "no-proxy-apis":
    state.reportProxyAPIs(ctx)
  case "no-react-deps":
    state.reportReactDeps(ctx)
  case "no-react-specific-props":
    state.reportReactSpecificProps(ctx)
  case "no-unknown-namespaces":
    state.reportUnknownNamespaces(ctx)
  case "prefer-classlist":
    state.reportPreferClassList(ctx)
  case "prefer-for":
    state.reportPreferFor(ctx)
  case "prefer-show":
    state.reportPreferShow(ctx)
  case "reactivity":
    state.reportReactivity(ctx)
  case "self-closing-comp":
    state.reportSelfClosing(ctx)
  case "style-prop":
    state.reportStyleProp(ctx)
  }
}

type solidState struct {
  hasSolid bool

  imports      []*shimast.Node
  calls        []*shimast.Node
  newExprs     []*shimast.Node
  variables    []*shimast.Node
  functions    []*shimast.Node
  returns      []*shimast.Node
  jsxAttrs     []*shimast.Node
  jsxOpenings  []*shimast.Node
  jsxElements  []*shimast.Node
  jsxExprs     []*shimast.Node
  jsxSpreads   []*shimast.Node
  declared     map[string]bool
  importedFrom map[string]string
  solidImport  map[string]string
  signals      map[string]bool
}

func collectSolidState(ctx *Context) *solidState {
  state := &solidState{
    declared:     map[string]bool{},
    importedFrom: map[string]string{},
    solidImport:  map[string]string{},
    signals:      map[string]bool{},
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
    case shimast.KindNewExpression:
      state.newExprs = append(state.newExprs, child)
    case shimast.KindVariableDeclaration:
      state.variables = append(state.variables, child)
      state.collectVariable(child)
    case shimast.KindFunctionDeclaration, shimast.KindFunctionExpression, shimast.KindArrowFunction:
      state.functions = append(state.functions, child)
      state.collectFunction(child)
    case shimast.KindReturnStatement:
      state.returns = append(state.returns, child)
    case shimast.KindJsxAttribute:
      state.jsxAttrs = append(state.jsxAttrs, child)
    case shimast.KindJsxOpeningElement, shimast.KindJsxSelfClosingElement:
      state.jsxOpenings = append(state.jsxOpenings, child)
    case shimast.KindJsxElement:
      state.jsxElements = append(state.jsxElements, child)
    case shimast.KindJsxExpression:
      state.jsxExprs = append(state.jsxExprs, child)
    case shimast.KindJsxSpreadAttribute:
      state.jsxSpreads = append(state.jsxSpreads, child)
    }
  })
  return state
}

func (s *solidState) collectImport(node *shimast.Node) {
  decl := node.AsImportDeclaration()
  if decl == nil {
    return
  }
  source := stringLiteralText(decl.ModuleSpecifier)
  if strings.HasPrefix(source, "solid-js") {
    s.hasSolid = true
  }
  if decl.ImportClause == nil {
    return
  }
  clause := decl.ImportClause.AsImportClause()
  if clause == nil {
    return
  }
  if name := identifierText(clause.Name()); name != "" {
    s.declared[name] = true
    s.importedFrom[name] = source
  }
  bindings := clause.NamedBindings
  if bindings == nil || bindings.Kind != shimast.KindNamedImports {
    return
  }
  named := bindings.AsNamedImports()
  if named == nil || named.Elements == nil {
    return
  }
  for _, specNode := range named.Elements.Nodes {
    spec := specNode.AsImportSpecifier()
    if spec == nil {
      continue
    }
    imported := solidImportName(spec.PropertyName)
    local := identifierText(spec.Name())
    if imported == "" {
      imported = local
    }
    if local == "" {
      continue
    }
    s.declared[local] = true
    s.importedFrom[local] = source
    if strings.HasPrefix(source, "solid-js") {
      s.solidImport[local] = imported
    }
  }
}

func (s *solidState) collectVariable(node *shimast.Node) {
  decl := node.AsVariableDeclaration()
  if decl == nil {
    return
  }
  collectSolidBindingNames(decl.Name(), s.declared)
  init := stripParens(decl.Initializer)
  if init == nil {
    return
  }
  initCall := init.AsCallExpression()
  if initCall == nil || s.callName(initCall) != "createSignal" {
    return
  }
  name := decl.Name()
  if name == nil || name.Kind != shimast.KindArrayBindingPattern {
    return
  }
  binding := name.AsBindingPattern()
  if binding == nil || binding.Elements == nil || len(binding.Elements.Nodes) == 0 {
    return
  }
  first := binding.Elements.Nodes[0].AsBindingElement()
  if first == nil {
    return
  }
  if local := identifierText(first.Name()); local != "" {
    s.signals[local] = true
  }
}

func (s *solidState) collectFunction(node *shimast.Node) {
  if name := solidFunctionName(node); name != "" {
    s.declared[name] = true
  }
  for _, param := range node.Parameters() {
    decl := param.AsParameterDeclaration()
    if decl != nil {
      collectSolidBindingNames(decl.Name(), s.declared)
    }
  }
}

func (s *solidState) reportImports(ctx *Context) {
  for _, node := range s.imports {
    decl := node.AsImportDeclaration()
    if decl == nil || decl.ImportClause == nil {
      continue
    }
    source := stringLiteralText(decl.ModuleSpecifier)
    if !isSolidSource(source) {
      continue
    }
    clause := decl.ImportClause.AsImportClause()
    if clause == nil || clause.NamedBindings == nil || clause.NamedBindings.Kind != shimast.KindNamedImports {
      continue
    }
    named := clause.NamedBindings.AsNamedImports()
    if named == nil || named.Elements == nil {
      continue
    }
    for _, specNode := range named.Elements.Nodes {
      spec := specNode.AsImportSpecifier()
      imported := ""
      if spec != nil {
        imported = solidImportName(spec.PropertyName)
        if imported == "" {
          imported = identifierText(spec.Name())
        }
      }
      if correct := solidPreferredSource(imported); correct != "" && correct != source {
        ctx.Report(specNode, "Import Solid API from its canonical module.")
      }
    }
  }
}

func (s *solidState) reportNoDestructure(ctx *Context) {
  for _, fn := range s.functions {
    if !solidFunctionHasJSX(fn) || functionIsInsideJSX(fn) || len(fn.Parameters()) != 1 {
      continue
    }
    param := fn.Parameters()[0].AsParameterDeclaration()
    if param != nil && param.Name() != nil && param.Name().Kind == shimast.KindObjectBindingPattern {
      ctx.Report(param.Name(), "Destructuring component props breaks Solid reactivity; use property access instead.")
    }
  }
}

func (s *solidState) reportComponentsReturnOnce(ctx *Context) {
  for _, fn := range s.functions {
    if !solidFunctionHasJSX(fn) || functionIsInsideJSX(fn) || !solidFunctionLooksComponent(fn) {
      continue
    }
    returns := solidReturnsInFunction(fn)
    if len(returns) <= 1 {
      continue
    }
    for _, ret := range returns[:len(returns)-1] {
      ctx.Report(ret, "Solid components run once; move early return conditions inside JSX.")
    }
    last := returns[len(returns)-1].AsReturnStatement()
    if last != nil && solidIsConditional(last.Expression) {
      ctx.Report(last.Expression, "Move conditional component returns inside JSX.")
    }
  }
}

func (s *solidState) reportInnerHTML(ctx *Context) {
  for _, attr := range s.jsxAttrs {
    name := solidJSXAttrName(attr)
    if name == "innerHTML" || name == "dangerouslySetInnerHTML" {
      ctx.Report(attr, "Avoid innerHTML in Solid JSX.")
    }
  }
}

func (s *solidState) reportEventHandlers(ctx *Context) {
  for _, attr := range s.jsxAttrs {
    if !solidAttrOnDOM(attr) {
      continue
    }
    name := solidJSXAttrName(attr)
    if len(name) > 2 && strings.HasPrefix(name, "on") && name[2] >= 'a' && name[2] <= 'z' {
      ctx.Report(attr, "Use Solid event handler casing such as onClick or the on: namespace.")
    }
  }
}

func (s *solidState) reportArrayHandlers(ctx *Context) {
  for _, attr := range s.jsxAttrs {
    if !solidAttrOnDOM(attr) {
      continue
    }
    name := solidJSXAttrName(attr)
    if !(strings.HasPrefix(name, "on") || strings.HasPrefix(name, "on:")) {
      continue
    }
    expr := solidJSXAttrExpression(attr)
    if expr != nil && expr.Kind == shimast.KindArrayLiteralExpression {
      ctx.Report(attr, "Passing an array as an event handler is type-unsafe.")
    }
  }
}

func (s *solidState) reportJSXNoUndef(ctx *Context) {
  if !s.hasSolid {
    return
  }
  for _, opening := range s.jsxOpenings {
    tag := solidJSXOpeningTag(opening)
    if tag == "" || solidIsDOMTag(tag) || strings.Contains(tag, ".") {
      continue
    }
    if !s.declared[tag] {
      ctx.Report(opening, "JSX component is not defined.")
    }
  }
}

func (s *solidState) reportDuplicateProps(ctx *Context) {
  for _, opening := range s.jsxOpenings {
    attrs := solidOpeningAttributes(opening)
    seen := map[string]*shimast.Node{}
    for _, attr := range attrs {
      name := solidJSXAttrName(attr)
      if name == "" {
        continue
      }
      key := strings.ToLower(strings.TrimPrefix(strings.TrimPrefix(name, "attr:"), "prop:"))
      if prev := seen[key]; prev != nil {
        ctx.Report(attr, "Duplicate JSX props are not allowed.")
      }
      seen[key] = attr
    }
  }
}

func (s *solidState) reportScriptURLs(ctx *Context) {
  for _, attr := range s.jsxAttrs {
    value := solidJSXAttrString(attr)
    if value == "" {
      continue
    }
    normalized := strings.ToLower(strings.TrimLeft(value, " \t\r\n"))
    normalized = strings.ReplaceAll(normalized, "\n", "")
    normalized = strings.ReplaceAll(normalized, "\r", "")
    normalized = strings.ReplaceAll(normalized, "\t", "")
    if strings.HasPrefix(normalized, "javascript:") {
      ctx.Report(attr, "Do not use javascript: URLs in JSX.")
    }
  }
}

func (s *solidState) reportReactSpecificProps(ctx *Context) {
  for _, attr := range s.jsxAttrs {
    if !solidAttrOnDOM(attr) {
      continue
    }
    switch solidJSXAttrName(attr) {
    case "className":
      ctx.Report(attr, "Use Solid's `class` prop instead of `className`.")
    case "htmlFor":
      ctx.Report(attr, "Use Solid's `for` prop instead of `htmlFor`.")
    case "key":
      ctx.Report(attr, "DOM elements in Solid do not need React-style `key` props.")
    }
  }
}

func (s *solidState) reportUnknownNamespaces(ctx *Context) {
  for _, attr := range s.jsxAttrs {
    name := solidJSXAttrName(attr)
    idx := strings.IndexByte(name, ':')
    if idx < 0 {
      continue
    }
    namespace := name[:idx]
    if !solidAttrOnDOM(attr) {
      ctx.Report(attr, "Namespaced props have no effect on Solid components.")
      continue
    }
    if !solidKnownNamespace(namespace) {
      ctx.Report(attr, "Unknown Solid JSX namespace.")
    }
  }
}

func (s *solidState) reportReactDeps(ctx *Context) {
  for _, node := range s.calls {
    call := node.AsCallExpression()
    if call == nil || call.Arguments == nil || len(call.Arguments.Nodes) != 2 {
      continue
    }
    name := s.callName(call)
    if name != "createEffect" && name != "createMemo" {
      continue
    }
    first := stripParens(call.Arguments.Nodes[0])
    second := stripParens(call.Arguments.Nodes[1])
    if solidIsFunction(first) && len(first.Parameters()) == 0 && second != nil && second.Kind == shimast.KindArrayLiteralExpression {
      ctx.Report(second, "Solid automatically tracks dependencies; remove React-style dependency arrays.")
    }
  }
}

func (s *solidState) reportProxyAPIs(ctx *Context) {
  for _, node := range s.imports {
    decl := node.AsImportDeclaration()
    if decl != nil && stringLiteralText(decl.ModuleSpecifier) == "solid-js/store" {
      ctx.Report(node, "Solid store APIs use Proxies.")
    }
  }
  for _, node := range s.newExprs {
    expr := node.AsNewExpression()
    if expr != nil && identifierText(stripParens(expr.Expression)) == "Proxy" {
      ctx.Report(node, "Proxy is incompatible with proxy-free Solid targets.")
    }
  }
  for _, node := range s.calls {
    call := node.AsCallExpression()
    if call == nil {
      continue
    }
    if isMatchingPropertyAccess(call.Expression, "Proxy", "revocable") || s.callName(call) == "mergeProps" {
      ctx.Report(node, "Avoid Proxy-based Solid APIs.")
    }
  }
}

func (s *solidState) reportPreferClassList(ctx *Context) {
  for _, attr := range s.jsxAttrs {
    name := solidJSXAttrName(attr)
    if name != "class" && name != "className" {
      continue
    }
    if solidOpeningHasAttr(attr.Parent, "classList") {
      continue
    }
    expr := solidJSXAttrExpression(attr)
    if expr == nil {
      continue
    }
    call := expr.AsCallExpression()
    if call == nil || call.Arguments == nil || len(call.Arguments.Nodes) != 1 {
      continue
    }
    callee := identifierText(stripParens(call.Expression))
    arg := stripParens(call.Arguments.Nodes[0])
    if (callee == "cn" || callee == "clsx" || callee == "classnames") && arg != nil && arg.Kind == shimast.KindObjectLiteralExpression {
      ctx.Report(attr, "Use Solid's classList prop instead of a classnames helper.")
    }
  }
}

func (s *solidState) reportPreferFor(ctx *Context) {
  for _, node := range s.calls {
    call := node.AsCallExpression()
    if call == nil || call.Arguments == nil || len(call.Arguments.Nodes) != 1 {
      continue
    }
    if !solidCallPropertyName(call, "map") || !solidInsideJSXExpression(node) || !solidIsFunction(stripParens(call.Arguments.Nodes[0])) {
      continue
    }
    ctx.Report(node, "Use Solid's <For> component for rendering lists.")
  }
}

func (s *solidState) reportPreferShow(ctx *Context) {
  for _, node := range s.jsxExprs {
    expr := node.AsJsxExpression()
    if expr == nil || expr.Expression == nil {
      continue
    }
    inner := stripParens(expr.Expression)
    if inner != nil && solidIsConditional(inner) {
      ctx.Report(inner, "Use Solid's <Show> component for conditional JSX.")
    }
  }
}

func (s *solidState) reportReactivity(ctx *Context) {
  for _, node := range s.calls {
    call := node.AsCallExpression()
    if call == nil || call.Arguments == nil || len(call.Arguments.Nodes) == 0 {
      continue
    }
    name := s.callName(call)
    if (name == "createEffect" || name == "createMemo" || name == "createComputed") && solidIsAsyncFunction(stripParens(call.Arguments.Nodes[0])) {
      ctx.Report(call.Arguments.Nodes[0], "Solid tracked scopes should not be async.")
    }
  }
  for _, node := range s.variables {
    decl := node.AsVariableDeclaration()
    if decl != nil && decl.Name() != nil && decl.Name().Kind == shimast.KindObjectBindingPattern && identifierText(stripParens(decl.Initializer)) == "props" {
      ctx.Report(decl.Name(), "Destructuring props breaks Solid reactivity.")
    }
  }
  for _, jsxExpr := range s.jsxExprs {
    expr := jsxExpr.AsJsxExpression()
    if expr == nil || expr.Expression == nil {
      continue
    }
    name := identifierText(stripParens(expr.Expression))
    if s.signals[name] {
      ctx.Report(expr.Expression, "Call Solid signal accessors inside JSX so updates are tracked.")
    }
  }
}

func (s *solidState) reportSelfClosing(ctx *Context) {
  for _, node := range s.jsxElements {
    elem := node.AsJsxElement()
    if elem == nil || elem.OpeningElement == nil || elem.Children == nil {
      continue
    }
    if solidJSXChildrenEmpty(ctx.File, elem.Children.Nodes) {
      ctx.Report(elem.OpeningElement, "Empty Solid JSX elements should be self-closing.")
    }
  }
}

func (s *solidState) reportStyleProp(ctx *Context) {
  for _, attr := range s.jsxAttrs {
    if solidJSXAttrName(attr) != "style" {
      continue
    }
    value := solidJSXAttrString(attr)
    if value != "" {
      ctx.Report(attr, "Use an object for Solid style props instead of a string.")
      continue
    }
    expr := solidJSXAttrExpression(attr)
    if expr == nil || expr.Kind != shimast.KindObjectLiteralExpression {
      continue
    }
    obj := expr.AsObjectLiteralExpression()
    if obj == nil || obj.Properties == nil {
      continue
    }
    for _, propNode := range obj.Properties.Nodes {
      prop := propNode.AsPropertyAssignment()
      if prop == nil {
        continue
      }
      name := solidPropertyName(prop.Name())
      if strings.ContainsAny(name, "ABCDEFGHIJKLMNOPQRSTUVWXYZ") {
        ctx.Report(prop.Name(), "Use kebab-case CSS property names in Solid style objects.")
      }
      if solidNumericLiteralNonZero(prop.Initializer) && solidLengthStyleName(name) {
        ctx.Report(prop.Initializer, "Numeric Solid style values need explicit units.")
      }
    }
  }
}

func (s *solidState) callName(call *shimast.CallExpression) string {
  if call == nil {
    return ""
  }
  expr := stripParens(call.Expression)
  if expr == nil {
    return ""
  }
  if name := identifierText(expr); name != "" {
    if imported := s.solidImport[name]; imported != "" {
      return imported
    }
    return name
  }
  if expr.Kind == shimast.KindPropertyAccessExpression {
    access := expr.AsPropertyAccessExpression()
    return identifierText(access.Name())
  }
  return ""
}

func solidImportName(node *shimast.Node) string {
  if node == nil {
    return ""
  }
  if name := identifierText(node); name != "" {
    return name
  }
  return stringLiteralText(node)
}

func collectSolidBindingNames(node *shimast.Node, out map[string]bool) {
  if node == nil {
    return
  }
  if name := identifierText(node); name != "" {
    out[name] = true
    return
  }
  switch node.Kind {
  case shimast.KindObjectBindingPattern, shimast.KindArrayBindingPattern:
    pattern := node.AsBindingPattern()
    if pattern == nil || pattern.Elements == nil {
      return
    }
    for _, elementNode := range pattern.Elements.Nodes {
      el := elementNode.AsBindingElement()
      if el != nil {
        collectSolidBindingNames(el.Name(), out)
      }
    }
  }
}

func solidFunctionName(node *shimast.Node) string {
  if node == nil {
    return ""
  }
  switch node.Kind {
  case shimast.KindFunctionDeclaration:
    decl := node.AsFunctionDeclaration()
    if decl != nil {
      return identifierText(decl.Name())
    }
  case shimast.KindFunctionExpression:
    expr := node.AsFunctionExpression()
    if expr != nil {
      return identifierText(expr.Name())
    }
  }
  if node.Parent != nil && node.Parent.Kind == shimast.KindVariableDeclaration {
    return identifierText(node.Parent.AsVariableDeclaration().Name())
  }
  return ""
}

func solidFunctionLooksComponent(node *shimast.Node) bool {
  name := solidFunctionName(node)
  return name != "" && name[0] >= 'A' && name[0] <= 'Z'
}

func solidFunctionHasJSX(node *shimast.Node) bool {
  found := false
  walkDescendants(node, func(child *shimast.Node) {
    if child != nil && (child.Kind == shimast.KindJsxElement || child.Kind == shimast.KindJsxSelfClosingElement || child.Kind == shimast.KindJsxFragment) {
      found = true
    }
  })
  return found
}

func functionIsInsideJSX(node *shimast.Node) bool {
  for cur := node.Parent; cur != nil; cur = cur.Parent {
    if cur.Kind == shimast.KindJsxExpression {
      return true
    }
  }
  return false
}

func solidReturnsInFunction(node *shimast.Node) []*shimast.Node {
  body := node.Body()
  if body == nil {
    return nil
  }
  returns := []*shimast.Node{}
  walkDescendants(body, func(child *shimast.Node) {
    if child == nil || child.Kind != shimast.KindReturnStatement {
      return
    }
    for cur := child.Parent; cur != nil && cur != body; cur = cur.Parent {
      if solidIsFunction(cur) {
        return
      }
    }
    returns = append(returns, child)
  })
  return returns
}

func solidIsFunction(node *shimast.Node) bool {
  if node == nil {
    return false
  }
  switch node.Kind {
  case shimast.KindFunctionDeclaration, shimast.KindFunctionExpression, shimast.KindArrowFunction:
    return true
  }
  return false
}

func solidIsAsyncFunction(node *shimast.Node) bool {
  if !solidIsFunction(node) {
    return false
  }
  return hasModifier(node, shimast.KindAsyncKeyword)
}

func solidIsConditional(node *shimast.Node) bool {
  if node == nil {
    return false
  }
  if node.Kind == shimast.KindConditionalExpression {
    return true
  }
  if node.Kind == shimast.KindBinaryExpression {
    expr := node.AsBinaryExpression()
    return expr != nil && expr.OperatorToken != nil &&
      (expr.OperatorToken.Kind == shimast.KindAmpersandAmpersandToken || expr.OperatorToken.Kind == shimast.KindBarBarToken)
  }
  return false
}

func solidJSXOpeningTag(node *shimast.Node) string {
  if node == nil {
    return ""
  }
  switch node.Kind {
  case shimast.KindJsxOpeningElement:
    open := node.AsJsxOpeningElement()
    if open != nil {
      return solidJSXNameText(open.TagName)
    }
  case shimast.KindJsxSelfClosingElement:
    open := node.AsJsxSelfClosingElement()
    if open != nil {
      return solidJSXNameText(open.TagName)
    }
  }
  return ""
}

func solidJSXNameText(node *shimast.Node) string {
  if node == nil {
    return ""
  }
  if name := identifierText(node); name != "" {
    return name
  }
  if node.Kind == shimast.KindPropertyAccessExpression {
    access := node.AsPropertyAccessExpression()
    left := solidJSXNameText(access.Expression)
    right := identifierText(access.Name())
    if left != "" && right != "" {
      return left + "." + right
    }
  }
  if node.Kind == shimast.KindJsxNamespacedName {
    ns := node.AsJsxNamespacedName()
    return identifierText(ns.Namespace) + ":" + identifierText(ns.Name())
  }
  return ""
}

func solidJSXAttrName(node *shimast.Node) string {
  attr := node.AsJsxAttribute()
  if attr == nil {
    return ""
  }
  return solidJSXNameText(attr.Name())
}

func solidOpeningAttributes(opening *shimast.Node) []*shimast.Node {
  if opening == nil {
    return nil
  }
  var attrs *shimast.Node
  if opening.Kind == shimast.KindJsxOpeningElement {
    attrs = opening.AsJsxOpeningElement().Attributes
  } else if opening.Kind == shimast.KindJsxSelfClosingElement {
    attrs = opening.AsJsxSelfClosingElement().Attributes
  }
  if attrs == nil {
    return nil
  }
  jsxAttrs := attrs.AsJsxAttributes()
  if jsxAttrs == nil || jsxAttrs.Properties == nil {
    return nil
  }
  out := []*shimast.Node{}
  for _, prop := range jsxAttrs.Properties.Nodes {
    if prop != nil && prop.Kind == shimast.KindJsxAttribute {
      out = append(out, prop)
    }
  }
  return out
}

func solidOpeningHasAttr(opening *shimast.Node, name string) bool {
  for _, attr := range solidOpeningAttributes(opening) {
    if solidJSXAttrName(attr) == name {
      return true
    }
  }
  return false
}

func solidAttrOnDOM(attr *shimast.Node) bool {
  for cur := attr.Parent; cur != nil; cur = cur.Parent {
    if cur.Kind == shimast.KindJsxOpeningElement || cur.Kind == shimast.KindJsxSelfClosingElement {
      return solidIsDOMTag(solidJSXOpeningTag(cur))
    }
  }
  return false
}

func solidJSXAttrExpression(attrNode *shimast.Node) *shimast.Node {
  attr := attrNode.AsJsxAttribute()
  if attr == nil || attr.Initializer == nil {
    return nil
  }
  if attr.Initializer.Kind == shimast.KindJsxExpression {
    expr := attr.Initializer.AsJsxExpression()
    if expr != nil {
      return stripParens(expr.Expression)
    }
  }
  return stripParens(attr.Initializer)
}

func solidJSXAttrString(attrNode *shimast.Node) string {
  attr := attrNode.AsJsxAttribute()
  if attr == nil || attr.Initializer == nil {
    return ""
  }
  return stringLiteralText(attr.Initializer)
}

func solidInsideJSXExpression(node *shimast.Node) bool {
  for cur := node.Parent; cur != nil; cur = cur.Parent {
    if cur.Kind == shimast.KindJsxExpression {
      return true
    }
  }
  return false
}

func solidCallPropertyName(call *shimast.CallExpression, name string) bool {
  if call == nil || call.Expression == nil || call.Expression.Kind != shimast.KindPropertyAccessExpression {
    return false
  }
  return identifierText(call.Expression.AsPropertyAccessExpression().Name()) == name
}

func solidJSXChildrenEmpty(file *shimast.SourceFile, children []*shimast.Node) bool {
  for _, child := range children {
    if child == nil {
      continue
    }
    if child.Kind == shimast.KindJsxText && strings.TrimSpace(nodeText(file, child)) == "" {
      continue
    }
    return false
  }
  return true
}

func solidPropertyName(node *shimast.Node) string {
  if name := identifierText(node); name != "" {
    return name
  }
  return stringLiteralText(node)
}

func solidNumericLiteralNonZero(node *shimast.Node) bool {
  if node == nil || node.Kind != shimast.KindNumericLiteral {
    return false
  }
  text := numericLiteralText(node)
  return text != "" && text != "0"
}

func solidLengthStyleName(name string) bool {
  switch strings.ToLower(name) {
  case "width", "height", "margin", "padding", "border-width", "font-size":
    return true
  }
  return false
}

func solidIsSolidComponentName(name string) bool {
  switch name {
  case "For", "Show", "Switch", "Match", "Index", "Portal", "Dynamic", "ErrorBoundary", "Suspense", "SuspenseList":
    return true
  }
  return false
}

func solidPreferredSource(name string) string {
  switch name {
  case "Portal", "render", "hydrate", "renderToString", "renderToStream", "isServer", "renderToStringAsync", "generateHydrationScript", "HydrationScript", "Dynamic":
    return "solid-js/web"
  case "createStore", "produce", "reconcile", "unwrap", "createMutable", "modifyMutable":
    return "solid-js/store"
  case "createSignal", "createEffect", "createMemo", "createResource", "onMount", "onCleanup", "onError", "untrack", "batch", "on", "createRoot", "getOwner", "runWithOwner", "mergeProps", "splitProps", "useTransition", "observable", "from", "mapArray", "indexArray", "createContext", "useContext", "children", "lazy", "createUniqueId", "createDeferred", "createRenderEffect", "createComputed", "createReaction", "createSelector", "DEV", "For", "Show", "Switch", "Match", "Index", "ErrorBoundary", "Suspense", "SuspenseList":
    return "solid-js"
  }
  return ""
}

func isSolidSource(source string) bool {
  return source == "solid-js" || source == "solid-js/web" || source == "solid-js/store"
}

func solidIsDOMTag(name string) bool {
  if name == "" {
    return false
  }
  return name[0] >= 'a' && name[0] <= 'z'
}

func solidKnownNamespace(namespace string) bool {
  switch namespace {
  case "on", "oncapture", "use", "prop", "attr", "bool", "xmlns", "xlink":
    return true
  }
  return false
}

func init() {
  for _, name := range []string{
    "components-return-once",
    "event-handlers",
    "imports",
    "jsx-no-duplicate-props",
    "jsx-no-script-url",
    "jsx-no-undef",
    "jsx-uses-vars",
    "no-array-handlers",
    "no-destructure",
    "no-innerhtml",
    "no-proxy-apis",
    "no-react-deps",
    "no-react-specific-props",
    "no-unknown-namespaces",
    "prefer-classlist",
    "prefer-for",
    "prefer-show",
    "reactivity",
    "self-closing-comp",
    "style-prop",
  } {
    Register(solidRule{name: name})
  }
}
