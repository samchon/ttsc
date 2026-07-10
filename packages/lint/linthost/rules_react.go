package linthost

import (
  "strings"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

const reactRulePrefix = "react/"

type reactRule struct {
  name string
}

func (r reactRule) Name() string { return reactRulePrefix + r.name }
func (r reactRule) Visits() []shimast.Kind {
  switch r.name {
  case "no-find-dom-node", "no-is-mounted":
    return []shimast.Kind{shimast.KindCallExpression}
  case "no-direct-mutation-state":
    return []shimast.Kind{shimast.KindBinaryExpression}
  case "no-unescaped-entities":
    return []shimast.Kind{shimast.KindJsxText}
  case "jsx-no-useless-fragment":
    return []shimast.Kind{shimast.KindJsxFragment, shimast.KindJsxElement, shimast.KindJsxSelfClosingElement}
  }
  return []shimast.Kind{shimast.KindJsxElement, shimast.KindJsxSelfClosingElement}
}

func (r reactRule) Check(ctx *Context, node *shimast.Node) {
  switch r.name {
  case "jsx-key":
    checkReactJSXKey(ctx, node)
  case "jsx-no-duplicate-props":
    checkReactJSXNoDuplicateProps(ctx, node)
  case "no-array-index-key":
    checkReactNoArrayIndexKey(ctx, node)
  case "no-children-prop":
    checkReactNoChildrenProp(ctx, node)
  case "no-danger":
    checkReactNoDanger(ctx, node)
  case "no-danger-with-children":
    checkReactNoDangerWithChildren(ctx, node)
  case "no-direct-mutation-state":
    checkReactNoDirectMutationState(ctx, node)
  case "no-find-dom-node":
    checkReactNoFindDOMNode(ctx, node)
  case "no-is-mounted":
    checkReactNoIsMounted(ctx, node)
  case "no-string-refs":
    checkReactNoStringRefs(ctx, node)
  case "no-unescaped-entities":
    checkReactNoUnescapedEntities(ctx, node)
  case "button-has-type":
    checkReactButtonHasType(ctx, node)
  case "iframe-missing-sandbox":
    checkReactIframeMissingSandbox(ctx, node)
  case "jsx-no-script-url":
    checkReactJSXNoScriptURL(ctx, node)
  case "jsx-no-target-blank":
    checkReactJSXNoTargetBlank(ctx, node)
  case "jsx-no-useless-fragment":
    checkReactJSXNoUselessFragment(ctx, node)
  case "style-prop-object":
    checkReactStylePropObject(ctx, node)
  case "void-dom-elements-no-children":
    checkReactVoidDOMElementsNoChildren(ctx, node)
  }
}

func checkReactJSXKey(ctx *Context, node *shimast.Node) {
  info := reactJSXElementFromNode(node)
  if info.opening == nil || reactJSXHasAttr(info.attrs, "key") {
    return
  }
  if reactJSXNeedsKey(node) {
    ctx.Report(info.opening, "Missing key prop for element in array or iterator.")
  }
}

func checkReactJSXNoDuplicateProps(ctx *Context, node *shimast.Node) {
  info := reactJSXElementFromNode(node)
  seen := map[string]*shimast.Node{}
  for _, attr := range info.attrs {
    name := strings.ToLower(attr.name)
    if name == "" {
      continue
    }
    if prev := seen[name]; prev != nil {
      ctx.Report(attr.node, "No duplicate props allowed.")
      continue
    }
    seen[name] = attr.node
  }
}

func checkReactNoArrayIndexKey(ctx *Context, node *shimast.Node) {
  info := reactJSXElementFromNode(node)
  attr, ok := reactFindJSXAttr(info.attrs, "key")
  if !ok {
    return
  }
  name := reactJSXAttrExpressionIdentifier(attr)
  if name != "" && reactJSXNeedsKey(node) && reactJSXKeyUsesMapIndex(node, name) {
    ctx.Report(attr.node, "Do not use array index as key.")
  }
}

func checkReactNoChildrenProp(ctx *Context, node *shimast.Node) {
  info := reactJSXElementFromNode(node)
  if attr, ok := reactFindJSXAttr(info.attrs, "children"); ok {
    ctx.Report(attr.node, "Do not pass children as a prop.")
  }
}

func checkReactNoDanger(ctx *Context, node *shimast.Node) {
  info := reactJSXElementFromNode(node)
  if attr, ok := reactFindJSXAttr(info.attrs, "dangerouslySetInnerHTML"); ok {
    ctx.Report(attr.node, "Do not use dangerouslySetInnerHTML.")
  }
}

func checkReactNoDangerWithChildren(ctx *Context, node *shimast.Node) {
  info := reactJSXElementFromNode(node)
  attr, ok := reactFindJSXAttr(info.attrs, "dangerouslySetInnerHTML")
  if ok && (reactJSXHasContent(info.children) || reactJSXHasAttr(info.attrs, "children")) {
    ctx.Report(attr.node, "Do not use dangerouslySetInnerHTML with children.")
  }
}

func checkReactNoDirectMutationState(ctx *Context, node *shimast.Node) {
  expr := node.AsBinaryExpression()
  if expr == nil || expr.OperatorToken == nil || !isAssignmentOperator(expr.OperatorToken.Kind) {
    return
  }
  if reactIsThisStateAccess(expr.Left) && !reactIsConstructorThisStateInitialization(node) {
    ctx.Report(expr.Left, "Do not mutate this.state directly.")
  }
}

func checkReactNoFindDOMNode(ctx *Context, node *shimast.Node) {
  call := node.AsCallExpression()
  if call == nil {
    return
  }
  if callCalleeName(call) == "findDOMNode" || reactIsNamedPropertyCall(call, "findDOMNode") {
    ctx.Report(node, "Do not use findDOMNode.")
  }
}

func checkReactNoIsMounted(ctx *Context, node *shimast.Node) {
  call := node.AsCallExpression()
  if call == nil {
    return
  }
  if callCalleeName(call) == "isMounted" || reactIsNamedPropertyCall(call, "isMounted") {
    ctx.Report(node, "Do not use isMounted.")
  }
}

func checkReactNoStringRefs(ctx *Context, node *shimast.Node) {
  info := reactJSXElementFromNode(node)
  attr, ok := reactFindJSXAttr(info.attrs, "ref")
  if ok && attr.known && attr.value != "" {
    ctx.Report(attr.node, "String refs are deprecated.")
  }
}

func checkReactNoUnescapedEntities(ctx *Context, node *shimast.Node) {
  text := nodeText(ctx.File, node)
  if strings.TrimSpace(text) == "" {
    return
  }
  for _, ch := range text {
    switch ch {
    case '>', '"', '\'', '}':
      ctx.Report(node, "Unescaped HTML entity in JSX text.")
      return
    }
  }
}

func checkReactButtonHasType(ctx *Context, node *shimast.Node) {
  info := reactJSXElementFromNode(node)
  if info.tag != "button" {
    return
  }
  attr, ok := reactFindJSXAttr(info.attrs, "type")
  if !ok {
    ctx.Report(info.opening, "button elements must have an explicit type.")
    return
  }
  if !attr.known {
    return
  }
  switch strings.ToLower(strings.TrimSpace(attr.value)) {
  case "button", "submit", "reset":
    return
  }
  ctx.Report(attr.node, "button type must be button, submit, or reset.")
}

func checkReactIframeMissingSandbox(ctx *Context, node *shimast.Node) {
  info := reactJSXElementFromNode(node)
  if info.tag == "iframe" && !reactJSXHasAttr(info.attrs, "sandbox") {
    ctx.Report(info.opening, "iframe elements must include a sandbox attribute.")
  }
}

func checkReactJSXNoScriptURL(ctx *Context, node *shimast.Node) {
  info := reactJSXElementFromNode(node)
  for _, name := range []string{"href", "src", "action", "formAction"} {
    attr, ok := reactFindJSXAttr(info.attrs, name)
    if ok && attr.known && strings.HasPrefix(strings.ToLower(strings.TrimSpace(attr.value)), "javascript:") {
      ctx.Report(attr.node, "Do not use javascript: URLs in JSX props.")
    }
  }
}

func checkReactJSXNoTargetBlank(ctx *Context, node *shimast.Node) {
  info := reactJSXElementFromNode(node)
  if info.opening == nil {
    return
  }
  target, ok := reactFindJSXAttr(info.attrs, "target")
  if !ok || !target.known {
    return
  }
  if strings.TrimSpace(target.value) != "_blank" {
    return
  }
  rel, ok := reactFindJSXAttr(info.attrs, "rel")
  if ok && rel.known && strings.Contains(rel.value, "noreferrer") {
    return
  }
  ctx.Report(info.opening, "JSX elements with `target=\"_blank\"` must include `rel=\"noreferrer\"` (or `noopener noreferrer`).")
}

func checkReactJSXNoUselessFragment(ctx *Context, node *shimast.Node) {
  children, ok := reactUselessFragmentChildren(node)
  if !ok {
    return
  }
  meaningful := reactMeaningfulJSXChildren(children)
  if len(meaningful) == 0 {
    ctx.Report(node, "Fragment wraps a single element — return the child directly.")
    return
  }
  if len(meaningful) == 1 {
    switch meaningful[0].Kind {
    case shimast.KindJsxElement, shimast.KindJsxSelfClosingElement, shimast.KindJsxFragment:
      ctx.Report(node, "Fragment wraps a single element — return the child directly.")
    }
  }
}

// reactUselessFragmentChildren returns the child list of a fragment-like node
// — the short `<>...</>` form or an explicit `<Fragment>` / `<React.Fragment>`
// element — along with `true`. For any other node it returns false.
//
// JsxSelfClosingElement is included so an empty `<Fragment />` is still
// considered a useless wrapper.
func reactUselessFragmentChildren(node *shimast.Node) (*shimast.NodeList, bool) {
  if node == nil {
    return nil, false
  }
  switch node.Kind {
  case shimast.KindJsxFragment:
    frag := node.AsJsxFragment()
    if frag == nil {
      return nil, false
    }
    return frag.Children, true
  case shimast.KindJsxElement:
    el := node.AsJsxElement()
    if el == nil || el.OpeningElement == nil {
      return nil, false
    }
    if !reactIsFragmentTagName(el.OpeningElement.TagName()) {
      return nil, false
    }
    return el.Children, true
  case shimast.KindJsxSelfClosingElement:
    el := node.AsJsxSelfClosingElement()
    if el == nil {
      return nil, false
    }
    if !reactIsFragmentTagName(el.TagName) {
      return nil, false
    }
    return nil, true
  }
  return nil, false
}

// reactIsFragmentTagName reports whether a JSX tag-name node refers to React's
// fragment component — either the bare `Fragment` identifier or the
// `React.Fragment` qualified form.
func reactIsFragmentTagName(node *shimast.Node) bool {
  if node == nil {
    return false
  }
  if identifierText(node) == "Fragment" {
    return true
  }
  if node.Kind == shimast.KindPropertyAccessExpression {
    access := node.AsPropertyAccessExpression()
    if access == nil {
      return false
    }
    if identifierText(access.Expression) == "React" && identifierText(access.Name()) == "Fragment" {
      return true
    }
  }
  return false
}

// reactMeaningfulJSXChildren returns the JSX children that contribute rendered
// output. Whitespace-only JsxText and empty JsxExpression nodes are skipped so
// the caller sees only nodes that could replace the fragment.
func reactMeaningfulJSXChildren(children *shimast.NodeList) []*shimast.Node {
  if children == nil {
    return nil
  }
  out := make([]*shimast.Node, 0, len(children.Nodes))
  for _, child := range children.Nodes {
    if child == nil {
      continue
    }
    if child.Kind == shimast.KindJsxText {
      if strings.TrimSpace(nodeText(nilSafeSourceFile(child), child)) == "" {
        continue
      }
      out = append(out, child)
      continue
    }
    if child.Kind == shimast.KindJsxExpression {
      expr := child.AsJsxExpression()
      if expr == nil || expr.Expression == nil {
        continue
      }
    }
    out = append(out, child)
  }
  return out
}

func checkReactStylePropObject(ctx *Context, node *shimast.Node) {
  info := reactJSXElementFromNode(node)
  attr, ok := reactFindJSXAttr(info.attrs, "style")
  if !ok || !attr.known {
    return
  }
  if attr.value != "" {
    ctx.Report(attr.node, "Style prop value must be an object.")
  }
}

func checkReactVoidDOMElementsNoChildren(ctx *Context, node *shimast.Node) {
  info := reactJSXElementFromNode(node)
  if !reactVoidDOMElement(info.tag) {
    return
  }
  if reactJSXHasContent(info.children) || reactJSXHasAttr(info.attrs, "children", "dangerouslySetInnerHTML") {
    ctx.Report(info.opening, "Void DOM elements must not receive children.")
  }
}

type reactJSXAttr struct {
  node    *shimast.Node
  name    string
  value   string
  known   bool
  boolean bool
}

type reactJSXElementInfo struct {
  opening  *shimast.Node
  tag      string
  attrs    []reactJSXAttr
  children *shimast.NodeList
}

func reactJSXElementFromNode(node *shimast.Node) reactJSXElementInfo {
  info := reactJSXElementInfo{}
  if node == nil {
    return info
  }
  switch node.Kind {
  case shimast.KindJsxElement:
    el := node.AsJsxElement()
    if el == nil || el.OpeningElement == nil {
      return info
    }
    info.opening = el.OpeningElement.AsNode()
    info.tag = reactJSXTagName(el.OpeningElement.TagName())
    info.attrs = reactJSXAttrs(el.OpeningElement.Attributes())
    info.children = el.Children
  case shimast.KindJsxSelfClosingElement:
    el := node.AsJsxSelfClosingElement()
    if el == nil {
      return info
    }
    info.opening = node
    info.tag = reactJSXTagName(el.TagName)
    info.attrs = reactJSXAttrs(el.Attributes)
  }
  return info
}

func reactJSXTagName(node *shimast.Node) string {
  if node == nil {
    return ""
  }
  if name := identifierText(node); name != "" {
    return name
  }
  return ""
}

func reactJSXAttrs(node *shimast.Node) []reactJSXAttr {
  if node == nil {
    return nil
  }
  attrs := node.AsJsxAttributes()
  if attrs == nil || attrs.Properties == nil {
    return nil
  }
  out := make([]reactJSXAttr, 0, len(attrs.Properties.Nodes))
  for _, prop := range attrs.Properties.Nodes {
    // `{...props}` members are JsxSpreadAttribute nodes; casting them
    // with AsJsxAttribute panics, so skip them like the nextjs and solid
    // helpers do. Treating spreads as not providing any prop matches the
    // upstream eslint-plugin-react defaults (jsx-ast-utils spreadStrict).
    if prop == nil || prop.Kind != shimast.KindJsxAttribute {
      continue
    }
    attr := prop.AsJsxAttribute()
    if attr == nil || attr.Name() == nil {
      continue
    }
    name := reactJSXAttrName(attr.Name())
    if name == "" {
      continue
    }
    out = append(out, reactJSXAttr{
      node:    prop,
      name:    name,
      value:   reactJSXAttrValue(attr.Initializer),
      known:   reactJSXAttrValueKnown(attr.Initializer),
      boolean: attr.Initializer == nil,
    })
  }
  return out
}

func reactJSXAttrName(node *shimast.Node) string {
  if node == nil {
    return ""
  }
  if name := identifierText(node); name != "" {
    return name
  }
  if node.Kind == shimast.KindJsxNamespacedName {
    ns := node.AsJsxNamespacedName()
    if ns != nil {
      left := identifierText(ns.Namespace)
      right := identifierText(ns.Name())
      if left != "" && right != "" {
        return left + ":" + right
      }
    }
  }
  return ""
}

func reactFindJSXAttr(attrs []reactJSXAttr, name string) (reactJSXAttr, bool) {
  for _, attr := range attrs {
    if attr.name == name {
      return attr, true
    }
  }
  return reactJSXAttr{}, false
}

func reactJSXHasAttr(attrs []reactJSXAttr, names ...string) bool {
  for _, name := range names {
    if _, ok := reactFindJSXAttr(attrs, name); ok {
      return true
    }
  }
  return false
}

func reactJSXAttrValue(node *shimast.Node) string {
  if node == nil {
    return "true"
  }
  if text := stringLiteralText(node); text != "" || node.Kind == shimast.KindStringLiteral || node.Kind == shimast.KindNoSubstitutionTemplateLiteral {
    return text
  }
  if node.Kind == shimast.KindJsxExpression {
    expr := node.AsJsxExpression()
    if expr == nil || expr.Expression == nil {
      return ""
    }
    if text := stringLiteralText(expr.Expression); text != "" || expr.Expression.Kind == shimast.KindStringLiteral || expr.Expression.Kind == shimast.KindNoSubstitutionTemplateLiteral {
      return text
    }
  }
  return ""
}

func reactJSXAttrValueKnown(node *shimast.Node) bool {
  if node == nil {
    return true
  }
  switch node.Kind {
  case shimast.KindStringLiteral, shimast.KindNoSubstitutionTemplateLiteral:
    return true
  case shimast.KindJsxExpression:
    expr := node.AsJsxExpression()
    if expr == nil || expr.Expression == nil {
      return true
    }
    switch expr.Expression.Kind {
    case shimast.KindStringLiteral, shimast.KindNoSubstitutionTemplateLiteral:
      return true
    }
  }
  return false
}

func reactJSXAttrExpressionIdentifier(attr reactJSXAttr) string {
  if attr.node == nil {
    return ""
  }
  jsxAttr := attr.node.AsJsxAttribute()
  if jsxAttr == nil || jsxAttr.Initializer == nil || jsxAttr.Initializer.Kind != shimast.KindJsxExpression {
    return ""
  }
  expr := jsxAttr.Initializer.AsJsxExpression()
  if expr == nil || expr.Expression == nil {
    return ""
  }
  return identifierText(stripParens(expr.Expression))
}

func reactJSXHasContent(children *shimast.NodeList) bool {
  if children == nil {
    return false
  }
  for _, child := range children.Nodes {
    if child == nil {
      continue
    }
    if child.Kind == shimast.KindJsxText {
      if strings.TrimSpace(nodeText(nilSafeSourceFile(child), child)) != "" {
        return true
      }
      continue
    }
    if child.Kind == shimast.KindJsxExpression {
      expr := child.AsJsxExpression()
      if expr == nil || expr.Expression == nil {
        continue
      }
    }
    return true
  }
  return false
}

func nilSafeSourceFile(node *shimast.Node) *shimast.SourceFile {
  for cur := node; cur != nil; cur = cur.Parent {
    if cur.Kind == shimast.KindSourceFile {
      return cur.AsSourceFile()
    }
  }
  return nil
}

func reactJSXNeedsKey(node *shimast.Node) bool {
  if reactInsideArrayLiteral(node) {
    return true
  }
  return reactIsMapCallbackReturn(node)
}

func reactInsideArrayLiteral(node *shimast.Node) bool {
  for cur := node.Parent; cur != nil; cur = cur.Parent {
    switch cur.Kind {
    case shimast.KindArrayLiteralExpression:
      return true
    case shimast.KindJsxElement, shimast.KindJsxSelfClosingElement:
      return false
    }
    if isFunctionLikeKind(cur) {
      return false
    }
  }
  return false
}

func reactIsMapCallbackReturn(node *shimast.Node) bool {
  fn := reactNearestFunctionLike(node)
  if fn == nil || !reactIsMapCallback(fn) {
    return false
  }
  body := fn.Body()
  if reactJSXIsReturnedExpression(node, body) {
    return true
  }
  for cur := node.Parent; cur != nil && cur != fn; cur = cur.Parent {
    if cur.Kind == shimast.KindReturnStatement {
      ret := cur.AsReturnStatement()
      return ret != nil && reactJSXIsReturnedExpression(node, ret.Expression)
    }
  }
  return false
}

func reactJSXIsReturnedExpression(node, expr *shimast.Node) bool {
  target := stripParens(expr)
  if target == nil {
    return false
  }
  for cur := node; cur != nil; cur = cur.Parent {
    if cur != node && (cur.Kind == shimast.KindJsxElement || cur.Kind == shimast.KindJsxSelfClosingElement) {
      return false
    }
    if stripParens(cur) == target {
      return true
    }
    if cur != node {
      switch cur.Kind {
      case shimast.KindParenthesizedExpression, shimast.KindConditionalExpression, shimast.KindBinaryExpression:
      default:
        return false
      }
    }
  }
  return false
}

func reactIsMapCallback(fn *shimast.Node) bool {
  if fn == nil || fn.Parent == nil || fn.Parent.Kind != shimast.KindCallExpression {
    return false
  }
  call := fn.Parent.AsCallExpression()
  if call == nil || call.Arguments == nil {
    return false
  }
  found := false
  for _, arg := range call.Arguments.Nodes {
    if stripParens(arg) == fn {
      found = true
      break
    }
  }
  if !found {
    return false
  }
  _, method, ok := reactPropertyAccessParts(call.Expression)
  return ok && method == "map"
}

func reactJSXKeyUsesMapIndex(node *shimast.Node, name string) bool {
  fn := reactNearestFunctionLike(node)
  if fn == nil || !reactIsMapCallback(fn) {
    return false
  }
  params := fn.Parameters()
  if len(params) < 2 {
    return false
  }
  param := params[1].AsParameterDeclaration()
  return param != nil && identifierText(param.Name()) == name
}

func reactPropertyAccessParts(node *shimast.Node) (*shimast.Node, string, bool) {
  node = stripParens(node)
  if node == nil || node.Kind != shimast.KindPropertyAccessExpression {
    return nil, "", false
  }
  access := node.AsPropertyAccessExpression()
  if access == nil {
    return nil, "", false
  }
  name := identifierText(access.Name())
  return access.Expression, name, name != ""
}

func reactIsNamedPropertyCall(call *shimast.CallExpression, name string) bool {
  if call == nil {
    return false
  }
  _, prop, ok := reactPropertyAccessParts(call.Expression)
  return ok && prop == name
}

func reactIsThisStateAccess(node *shimast.Node) bool {
  for cur := stripParens(node); cur != nil; {
    obj, prop, ok := reactPropertyAccessParts(cur)
    if !ok {
      return false
    }
    if prop == "state" && obj != nil && obj.Kind == shimast.KindThisKeyword {
      return true
    }
    cur = obj
  }
  return false
}

func reactIsConstructorThisStateInitialization(node *shimast.Node) bool {
  if !reactIsExactThisStateAssignment(node) {
    return false
  }
  for cur := node.Parent; cur != nil; cur = cur.Parent {
    if cur.Kind == shimast.KindConstructor {
      return true
    }
    if isFunctionLikeKind(cur) && cur.Kind != shimast.KindConstructor {
      return false
    }
  }
  return false
}

func reactIsExactThisStateAssignment(node *shimast.Node) bool {
  expr := node.AsBinaryExpression()
  if expr == nil || expr.Left == nil {
    return false
  }
  obj, prop, ok := reactPropertyAccessParts(expr.Left)
  return ok && prop == "state" && obj != nil && obj.Kind == shimast.KindThisKeyword
}

func reactVoidDOMElement(tag string) bool {
  switch tag {
  case "area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr":
    return true
  }
  return false
}

func reactNearestFunctionLike(node *shimast.Node) *shimast.Node {
  for cur := node.Parent; cur != nil; cur = cur.Parent {
    if isFunctionLikeKind(cur) {
      return cur
    }
  }
  return nil
}

func init() {
  for _, name := range []string{
    "button-has-type",
    "iframe-missing-sandbox",
    "jsx-key",
    "jsx-no-duplicate-props",
    "jsx-no-script-url",
    "jsx-no-target-blank",
    "jsx-no-useless-fragment",
    "no-array-index-key",
    "no-children-prop",
    "no-danger",
    "no-danger-with-children",
    "no-direct-mutation-state",
    "no-find-dom-node",
    "no-is-mounted",
    "no-string-refs",
    "no-unescaped-entities",
    "style-prop-object",
    "void-dom-elements-no-children",
  } {
    Register(reactRule{name: name})
  }
}
