package linthost

import (
  "strconv"
  "strings"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

type jsxAttr struct {
  node    *shimast.Node
  value   string
  known   bool
  boolean bool
}

type jsxElementInfo struct {
  opening  *shimast.Node
  tag      string
  attrs    map[string]jsxAttr
  children *shimast.NodeList
  // spread is true when the opening element carries at least one
  // `{...props}` JsxSpreadAttribute. The spread's contents are unknown at
  // lint time, so rules that report on the *absence* of an attribute must
  // treat the element conservatively: the missing attribute could be
  // provided by the spread, and `@ttsc/lint` findings are build-breaking
  // compiler errors, so absence-predicated reports bail out instead of
  // guessing. Reports about explicitly present attributes still fire.
  spread bool
}

func jsxElementFromNode(node *shimast.Node) jsxElementInfo {
  info := jsxElementInfo{attrs: map[string]jsxAttr{}}
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
    info.tag = jsxTagName(el.OpeningElement.TagName())
    info.attrs, info.spread = jsxAttrs(el.OpeningElement.Attributes())
    info.children = el.Children
  case shimast.KindJsxSelfClosingElement:
    el := node.AsJsxSelfClosingElement()
    if el == nil {
      return info
    }
    info.opening = node
    info.tag = jsxTagName(el.TagName)
    info.attrs, info.spread = jsxAttrs(el.Attributes)
  case shimast.KindJsxOpeningElement:
    el := node.AsJsxOpeningElement()
    if el == nil {
      return info
    }
    info.opening = node
    info.tag = jsxTagName(el.TagName)
    info.attrs, info.spread = jsxAttrs(el.Attributes)
  }
  return info
}

func jsxTagName(node *shimast.Node) string {
  if node == nil {
    return ""
  }
  if name := identifierText(node); name != "" {
    return name
  }
  return ""
}

// jsxAttrs collects the named attributes of a JSX attributes node. The
// second result reports whether the list also contains a
// JsxSpreadAttribute (`{...props}`); spread members carry an unknown prop
// set and cannot be cast with AsJsxAttribute (the interface conversion
// panics), so they are skipped here and surfaced through the flag.
func jsxAttrs(node *shimast.Node) (map[string]jsxAttr, bool) {
  out := map[string]jsxAttr{}
  spread := false
  if node == nil {
    return out, spread
  }
  attrs := node.AsJsxAttributes()
  if attrs == nil || attrs.Properties == nil {
    return out, spread
  }
  for _, prop := range attrs.Properties.Nodes {
    if prop == nil || prop.Kind != shimast.KindJsxAttribute {
      if prop != nil && prop.Kind == shimast.KindJsxSpreadAttribute {
        spread = true
      }
      continue
    }
    attr := prop.AsJsxAttribute()
    if attr == nil || attr.Name() == nil {
      continue
    }
    name := jsxAttrName(attr.Name())
    if name == "" {
      continue
    }
    out[name] = jsxAttr{
      node:    prop,
      value:   jsxAttrValue(attr.Initializer),
      known:   jsxAttrValueKnown(attr.Initializer),
      boolean: attr.Initializer == nil,
    }
  }
  return out, spread
}

func jsxAttrName(node *shimast.Node) string {
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

func jsxAttrValue(node *shimast.Node) string {
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
    if value, ok := isLiteralBoolean(expr.Expression); ok {
      if value {
        return "true"
      }
      return "false"
    }
    if expr.Expression.Kind == shimast.KindNumericLiteral {
      return numericLiteralText(expr.Expression)
    }
  }
  return ""
}

func jsxAttrValueKnown(node *shimast.Node) bool {
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
    case shimast.KindStringLiteral, shimast.KindNoSubstitutionTemplateLiteral, shimast.KindTrueKeyword, shimast.KindFalseKeyword, shimast.KindNumericLiteral:
      return true
    }
  }
  return false
}

func jsxHasAttr(attrs map[string]jsxAttr, names ...string) bool {
  for _, name := range names {
    if _, ok := attrs[name]; ok {
      return true
    }
  }
  return false
}

func jsxKnownAttr(attrs map[string]jsxAttr, name string) (jsxAttr, bool) {
  attr, ok := attrs[name]
  if !ok || !attr.known {
    return jsxAttr{}, false
  }
  return attr, true
}

func jsxBoolAttr(attrs map[string]jsxAttr, name string) (bool, bool) {
  attr, ok := jsxKnownAttr(attrs, name)
  if !ok {
    return false, false
  }
  if attr.boolean {
    return true, true
  }
  switch strings.ToLower(strings.TrimSpace(attr.value)) {
  case "true":
    return true, true
  case "false":
    return false, true
  }
  return false, false
}

func jsxNumericAttr(attrs map[string]jsxAttr, names ...string) (int, bool) {
  for _, name := range names {
    attr, ok := jsxKnownAttr(attrs, name)
    if !ok || strings.TrimSpace(attr.value) == "" {
      continue
    }
    value, err := strconv.Atoi(strings.TrimSpace(attr.value))
    if err == nil {
      return value, true
    }
  }
  return 0, false
}

func jsxHasAccessibleLabel(info jsxElementInfo) bool {
  if attr, ok := jsxKnownAttr(info.attrs, "aria-label"); ok && strings.TrimSpace(attr.value) != "" {
    return true
  }
  if attr, ok := jsxKnownAttr(info.attrs, "aria-labelledby"); ok && strings.TrimSpace(attr.value) != "" {
    return true
  }
  if attr, ok := jsxKnownAttr(info.attrs, "alt"); ok && strings.TrimSpace(attr.value) != "" {
    return true
  }
  if attr, ok := jsxKnownAttr(info.attrs, "title"); ok && strings.TrimSpace(attr.value) != "" {
    return true
  }
  return jsxChildrenHaveAccessibleContent(info.children)
}

func jsxChildrenHaveAccessibleContent(children *shimast.NodeList) bool {
  if children == nil {
    return false
  }
  for _, child := range children.Nodes {
    if child == nil {
      continue
    }
    switch child.Kind {
    case shimast.KindJsxText:
      text := child.AsJsxText()
      if text != nil && !text.ContainsOnlyTriviaWhiteSpaces && strings.TrimSpace(text.Text) != "" {
        return true
      }
    case shimast.KindJsxExpression:
      expr := child.AsJsxExpression()
      if expr != nil && expr.Expression != nil {
        if text := stringLiteralText(expr.Expression); strings.TrimSpace(text) != "" {
          return true
        }
        if expr.Expression.Kind != shimast.KindNullKeyword && identifierText(expr.Expression) != "undefined" {
          return true
        }
      }
    case shimast.KindJsxElement, shimast.KindJsxSelfClosingElement:
      nested := jsxElementFromNode(child)
      if jsxHasAccessibleLabel(nested) {
        return true
      }
    }
  }
  return false
}

func jsxHasDescendantControl(children *shimast.NodeList) bool {
  if children == nil {
    return false
  }
  for _, child := range children.Nodes {
    if child == nil {
      continue
    }
    switch child.Kind {
    case shimast.KindJsxElement, shimast.KindJsxSelfClosingElement:
      info := jsxElementFromNode(child)
      if jsxIsFormControl(info) {
        return true
      }
      if jsxHasDescendantControl(info.children) {
        return true
      }
    }
  }
  return false
}

func jsxHasTrackCaption(children *shimast.NodeList) bool {
  if children == nil {
    return false
  }
  for _, child := range children.Nodes {
    info := jsxElementFromNode(child)
    if info.tag != "track" {
      continue
    }
    attr, ok := jsxKnownAttr(info.attrs, "kind")
    if !ok {
      return true
    }
    kind := strings.ToLower(strings.TrimSpace(attr.value))
    if kind == "captions" || kind == "subtitles" {
      return true
    }
  }
  return false
}

func jsxIsFormControl(info jsxElementInfo) bool {
  switch info.tag {
  case "button", "select", "textarea":
    return true
  case "input":
    if attr, ok := jsxKnownAttr(info.attrs, "type"); ok && strings.EqualFold(attr.value, "hidden") {
      return false
    }
    return true
  }
  return false
}

func jsxIsHidden(info jsxElementInfo) bool {
  if value, ok := jsxBoolAttr(info.attrs, "aria-hidden"); ok && value {
    return true
  }
  _, hidden := info.attrs["hidden"]
  return hidden
}

func jsxHasKeyboardHandler(attrs map[string]jsxAttr) bool {
  return jsxHasAttr(attrs, "onKeyDown", "onKeyUp", "onKeyPress", "onkeydown", "onkeyup", "onkeypress")
}

func jsxHasMouseOrKeyboardInteraction(attrs map[string]jsxAttr) bool {
  return jsxHasAttr(
    attrs,
    "onClick", "onclick",
    "onMouseDown", "onmousedown",
    "onMouseUp", "onmouseup",
    "onKeyDown", "onkeydown",
    "onKeyUp", "onkeyup",
    "onKeyPress", "onkeypress",
  )
}

func jsxRole(attrs map[string]jsxAttr) (string, bool) {
  attr, ok := jsxKnownAttr(attrs, "role")
  if !ok {
    return "", false
  }
  for _, token := range strings.Fields(strings.ToLower(attr.value)) {
    if token != "" {
      return token, true
    }
  }
  return "", true
}

func jsxImplicitRole(info jsxElementInfo) string {
  switch info.tag {
  case "a", "area":
    if jsxHasAttr(info.attrs, "href") {
      return "link"
    }
  case "article":
    return "article"
  case "button":
    return "button"
  case "img":
    return "img"
  case "input":
    if attr, ok := jsxKnownAttr(info.attrs, "type"); ok {
      switch strings.ToLower(attr.value) {
      case "button", "submit", "reset":
        return "button"
      case "checkbox":
        return "checkbox"
      case "radio":
        return "radio"
      case "range":
        return "slider"
      case "email", "password", "search", "tel", "text", "url":
        return "textbox"
      }
    }
    return "textbox"
  case "select":
    return "combobox"
  case "textarea":
    return "textbox"
  case "nav":
    return "navigation"
  case "main":
    return "main"
  case "ul", "ol":
    return "list"
  case "li":
    return "listitem"
  case "table":
    return "table"
  case "tr":
    return "row"
  case "td":
    return "cell"
  case "th":
    return "columnheader"
  case "h1", "h2", "h3", "h4", "h5", "h6":
    return "heading"
  }
  return ""
}

func jsxIsInteractive(info jsxElementInfo) bool {
  if role, ok := jsxRole(info.attrs); ok && jsxInteractiveRoles[role] {
    return true
  }
  switch jsxImplicitRole(info) {
  case "button", "checkbox", "combobox", "link", "radio", "slider", "textbox":
    return true
  }
  return false
}

func jsxIsFocusable(info jsxElementInfo) bool {
  if disabled, ok := jsxBoolAttr(info.attrs, "disabled"); ok && disabled {
    return false
  }
  if value, ok := jsxNumericAttr(info.attrs, "tabIndex", "tabindex"); ok && value >= 0 {
    return true
  }
  switch info.tag {
  case "button", "input", "select", "textarea":
    return true
  case "a", "area":
    return jsxHasAttr(info.attrs, "href")
  }
  return false
}

func jsxIsNonInteractiveElement(tag string) bool {
  switch tag {
  case "article", "aside", "div", "footer", "header", "li", "main", "nav", "ol", "p", "section", "ul",
    "h1", "h2", "h3", "h4", "h5", "h6":
    return true
  }
  return false
}

var jsxA11yRoles = map[string]bool{
  "alert": true, "alertdialog": true, "application": true, "article": true, "banner": true,
  "button": true, "cell": true, "checkbox": true, "columnheader": true, "combobox": true,
  "complementary": true, "contentinfo": true, "definition": true, "dialog": true, "directory": true,
  "document": true, "feed": true, "figure": true, "form": true, "grid": true, "gridcell": true,
  "group": true, "heading": true, "img": true, "link": true, "list": true, "listbox": true,
  "listitem": true, "log": true, "main": true, "marquee": true, "math": true, "menu": true,
  "menubar": true, "menuitem": true, "menuitemcheckbox": true, "menuitemradio": true,
  "meter": true, "navigation": true, "none": true, "note": true, "option": true, "presentation": true,
  "progressbar": true, "radio": true, "radiogroup": true, "region": true, "row": true,
  "rowgroup": true, "rowheader": true, "scrollbar": true, "search": true, "searchbox": true,
  "separator": true, "slider": true, "spinbutton": true, "status": true, "switch": true,
  "tab": true, "table": true, "tablist": true, "tabpanel": true, "term": true, "textbox": true,
  "timer": true, "toolbar": true, "tooltip": true, "tree": true, "treegrid": true, "treeitem": true,
}

var jsxInteractiveRoles = map[string]bool{
  "button": true, "checkbox": true, "combobox": true, "gridcell": true, "link": true,
  "listbox": true, "menuitem": true, "menuitemcheckbox": true, "menuitemradio": true,
  "option": true, "radio": true, "scrollbar": true, "searchbox": true, "slider": true,
  "spinbutton": true, "switch": true, "tab": true, "textbox": true, "treeitem": true,
}

var jsxNonInteractiveRoles = map[string]bool{
  "article": true, "complementary": true, "contentinfo": true, "definition": true,
  "document": true, "feed": true, "figure": true, "group": true, "heading": true,
  "img": true, "list": true, "listitem": true, "main": true, "navigation": true,
  "none": true, "note": true, "presentation": true, "region": true, "row": true,
  "rowgroup": true, "separator": true, "table": true, "term": true, "toolbar": true,
}

var jsxAriaProps = map[string]bool{
  "aria-activedescendant": true, "aria-atomic": true, "aria-autocomplete": true, "aria-braillelabel": true,
  "aria-brailleroledescription": true, "aria-busy": true, "aria-checked": true, "aria-colcount": true,
  "aria-colindex": true, "aria-colindextext": true, "aria-colspan": true, "aria-controls": true,
  "aria-current": true, "aria-describedby": true, "aria-description": true, "aria-details": true,
  "aria-disabled": true, "aria-dropeffect": true, "aria-errormessage": true, "aria-expanded": true,
  "aria-flowto": true, "aria-grabbed": true, "aria-haspopup": true, "aria-hidden": true,
  "aria-invalid": true, "aria-keyshortcuts": true, "aria-label": true, "aria-labelledby": true,
  "aria-level": true, "aria-live": true, "aria-modal": true, "aria-multiline": true,
  "aria-multiselectable": true, "aria-orientation": true, "aria-owns": true, "aria-placeholder": true,
  "aria-posinset": true, "aria-pressed": true, "aria-readonly": true, "aria-relevant": true,
  "aria-required": true, "aria-roledescription": true, "aria-rowcount": true, "aria-rowindex": true,
  "aria-rowindextext": true, "aria-rowspan": true, "aria-selected": true, "aria-setsize": true,
  "aria-sort": true, "aria-valuemax": true, "aria-valuemin": true, "aria-valuenow": true,
  "aria-valuetext": true,
}

var jsxGlobalAriaProps = map[string]bool{
  "aria-atomic": true, "aria-busy": true, "aria-controls": true, "aria-current": true,
  "aria-describedby": true, "aria-description": true, "aria-details": true, "aria-disabled": true,
  "aria-dropeffect": true, "aria-errormessage": true, "aria-flowto": true, "aria-grabbed": true,
  "aria-haspopup": true, "aria-hidden": true, "aria-invalid": true, "aria-keyshortcuts": true,
  "aria-label": true, "aria-labelledby": true, "aria-live": true, "aria-owns": true,
  "aria-relevant": true, "aria-roledescription": true,
}

var jsxRoleRequiredProps = map[string][]string{
  "checkbox":         {"aria-checked"},
  "combobox":         {"aria-controls", "aria-expanded"},
  "heading":          {"aria-level"},
  "menuitemcheckbox": {"aria-checked"},
  "menuitemradio":    {"aria-checked"},
  "option":           {"aria-selected"},
  "radio":            {"aria-checked"},
  "scrollbar":        {"aria-controls", "aria-valuenow"},
  "slider":           {"aria-valuenow"},
  "spinbutton":       {"aria-valuenow"},
  "switch":           {"aria-checked"},
}

var jsxRoleSupportedProps = map[string]map[string]bool{
  "button":     {"aria-expanded": true, "aria-pressed": true},
  "checkbox":   {"aria-checked": true, "aria-readonly": true},
  "combobox":   {"aria-activedescendant": true, "aria-autocomplete": true, "aria-controls": true, "aria-expanded": true, "aria-readonly": true, "aria-required": true},
  "heading":    {"aria-level": true},
  "img":        {"aria-label": true, "aria-labelledby": true},
  "link":       {"aria-expanded": true},
  "radio":      {"aria-checked": true},
  "slider":     {"aria-orientation": true, "aria-valuemax": true, "aria-valuemin": true, "aria-valuenow": true, "aria-valuetext": true},
  "spinbutton": {"aria-valuemax": true, "aria-valuemin": true, "aria-valuenow": true, "aria-valuetext": true},
  "switch":     {"aria-checked": true},
  "tab":        {"aria-controls": true, "aria-selected": true},
  "textbox":    {"aria-activedescendant": true, "aria-autocomplete": true, "aria-multiline": true, "aria-placeholder": true, "aria-readonly": true, "aria-required": true},
}

var jsxRedundantRoles = map[string]string{
  "button": "button", "img": "img", "main": "main", "nav": "navigation", "ul": "list", "ol": "list",
  "li": "listitem", "table": "table", "tr": "row", "td": "cell",
}

var jsxRolePreferredTag = map[string]string{
  "button": "button", "checkbox": "input", "heading": "h1-h6", "img": "img", "link": "a",
  "list": "ul or ol", "listitem": "li", "main": "main", "navigation": "nav", "radio": "input",
  "table": "table", "textbox": "input or textarea",
}

var jsxAutocompleteTokens = map[string]bool{
  "on": true, "off": true, "name": true, "honorific-prefix": true, "given-name": true,
  "additional-name": true, "family-name": true, "honorific-suffix": true, "nickname": true,
  "email": true, "username": true, "new-password": true, "current-password": true,
  "one-time-code": true, "organization-title": true, "organization": true,
  "street-address": true, "address-line1": true, "address-line2": true, "address-line3": true,
  "address-level1": true, "address-level2": true, "address-level3": true, "address-level4": true,
  "country": true, "country-name": true, "postal-code": true, "cc-name": true,
  "cc-given-name": true, "cc-additional-name": true, "cc-family-name": true, "cc-number": true,
  "cc-exp": true, "cc-exp-month": true, "cc-exp-year": true, "cc-csc": true, "cc-type": true,
  "transaction-currency": true, "transaction-amount": true, "language": true, "bday": true,
  "bday-day": true, "bday-month": true, "bday-year": true, "sex": true, "tel": true,
  "tel-country-code": true, "tel-national": true, "tel-area-code": true, "tel-local": true,
  "tel-extension": true, "impp": true, "url": true, "photo": true,
}

type jsxA11yAltText struct{}

func (jsxA11yAltText) Name() string { return "jsx-a11y/alt-text" }
func (jsxA11yAltText) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindJsxElement, shimast.KindJsxSelfClosingElement}
}
func (jsxA11yAltText) Check(ctx *Context, node *shimast.Node) {
  info := jsxElementFromNode(node)
  // Every report below is about a missing alt/label, which a spread may
  // provide.
  if info.spread {
    return
  }
  switch info.tag {
  case "img", "area":
    if !jsxHasAttr(info.attrs, "alt", "aria-label", "aria-labelledby") {
      ctx.Report(info.opening, "Image-like elements must have alt text.")
    }
  case "input":
    attr, ok := jsxKnownAttr(info.attrs, "type")
    if ok && strings.EqualFold(attr.value, "image") && !jsxHasAttr(info.attrs, "alt", "aria-label", "aria-labelledby") {
      ctx.Report(info.opening, "Image input elements must have alt text.")
    }
  case "object":
    if !jsxHasAccessibleLabel(info) {
      ctx.Report(info.opening, "Object elements must have accessible text.")
    }
  }
}

type jsxA11yAnchorHasContent struct{}

func (jsxA11yAnchorHasContent) Name() string           { return "jsx-a11y/anchor-has-content" }
func (jsxA11yAnchorHasContent) Visits() []shimast.Kind { return []shimast.Kind{shimast.KindJsxElement} }
func (jsxA11yAnchorHasContent) Check(ctx *Context, node *shimast.Node) {
  info := jsxElementFromNode(node)
  if info.tag == "a" && !info.spread && !jsxHasAccessibleLabel(info) {
    ctx.Report(info.opening, "Anchors must have accessible content.")
  }
}

type jsxA11yAnchorIsValid struct{}

func (jsxA11yAnchorIsValid) Name() string { return "jsx-a11y/anchor-is-valid" }
func (jsxA11yAnchorIsValid) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindJsxElement, shimast.KindJsxSelfClosingElement}
}
func (jsxA11yAnchorIsValid) Check(ctx *Context, node *shimast.Node) {
  info := jsxElementFromNode(node)
  if info.tag != "a" {
    return
  }
  href, ok := jsxKnownAttr(info.attrs, "href")
  if !ok {
    // The href may be provided (or statically unknowable) through a
    // spread; only its outright absence is reportable.
    if !info.spread {
      ctx.Report(info.opening, "Anchor elements must have a valid href.")
    }
    return
  }
  value := strings.TrimSpace(strings.ToLower(href.value))
  if value == "" || value == "#" || strings.HasPrefix(value, "javascript:") {
    ctx.Report(href.node, "Anchor href must be a valid navigation target.")
  }
}

type jsxA11yAriaActivedescendantHasTabindex struct{}

func (jsxA11yAriaActivedescendantHasTabindex) Name() string {
  return "jsx-a11y/aria-activedescendant-has-tabindex"
}
func (jsxA11yAriaActivedescendantHasTabindex) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindJsxElement, shimast.KindJsxSelfClosingElement}
}
func (jsxA11yAriaActivedescendantHasTabindex) Check(ctx *Context, node *shimast.Node) {
  info := jsxElementFromNode(node)
  if jsxHasAttr(info.attrs, "aria-activedescendant") && !info.spread && !jsxHasAttr(info.attrs, "tabIndex", "tabindex") {
    ctx.Report(info.opening, "Elements with aria-activedescendant must define tabIndex.")
  }
}

type jsxA11yAriaProps struct{}

func (jsxA11yAriaProps) Name() string           { return "jsx-a11y/aria-props" }
func (jsxA11yAriaProps) Visits() []shimast.Kind { return []shimast.Kind{shimast.KindJsxAttribute} }
func (jsxA11yAriaProps) Check(ctx *Context, node *shimast.Node) {
  attr := node.AsJsxAttribute()
  if attr == nil || attr.Name() == nil {
    return
  }
  name := strings.ToLower(jsxAttrName(attr.Name()))
  if strings.HasPrefix(name, "aria-") && !jsxAriaProps[name] {
    ctx.Report(node, "Unknown ARIA property "+name+".")
  }
}

type jsxA11yAriaProptypes struct{}

func (jsxA11yAriaProptypes) Name() string           { return "jsx-a11y/aria-proptypes" }
func (jsxA11yAriaProptypes) Visits() []shimast.Kind { return []shimast.Kind{shimast.KindJsxAttribute} }
func (jsxA11yAriaProptypes) Check(ctx *Context, node *shimast.Node) {
  attr := node.AsJsxAttribute()
  if attr == nil || attr.Name() == nil {
    return
  }
  name := strings.ToLower(jsxAttrName(attr.Name()))
  value := strings.ToLower(strings.TrimSpace(jsxAttrValue(attr.Initializer)))
  if !jsxAttrValueKnown(attr.Initializer) || value == "" {
    return
  }
  switch name {
  case "aria-hidden", "aria-disabled", "aria-expanded", "aria-modal", "aria-multiline", "aria-multiselectable", "aria-readonly", "aria-required", "aria-selected":
    if value != "true" && value != "false" {
      ctx.Report(node, name+" must be true or false.")
    }
  case "aria-checked", "aria-pressed":
    if value != "true" && value != "false" && value != "mixed" {
      ctx.Report(node, name+" must be true, false, or mixed.")
    }
  case "aria-level", "aria-valuemax", "aria-valuemin", "aria-valuenow", "aria-posinset", "aria-setsize", "aria-colcount", "aria-colindex", "aria-colspan", "aria-rowcount", "aria-rowindex", "aria-rowspan":
    if _, err := strconv.Atoi(value); err != nil {
      ctx.Report(node, name+" must be numeric.")
    }
  }
}

type jsxA11yAriaRole struct{}

func (jsxA11yAriaRole) Name() string           { return "jsx-a11y/aria-role" }
func (jsxA11yAriaRole) Visits() []shimast.Kind { return []shimast.Kind{shimast.KindJsxAttribute} }
func (jsxA11yAriaRole) Check(ctx *Context, node *shimast.Node) {
  attr := node.AsJsxAttribute()
  if attr == nil || attr.Name() == nil || jsxAttrName(attr.Name()) != "role" || !jsxAttrValueKnown(attr.Initializer) {
    return
  }
  tokens := strings.Fields(strings.ToLower(jsxAttrValue(attr.Initializer)))
  if len(tokens) == 0 {
    ctx.Report(node, "Role must not be empty.")
    return
  }
  for _, token := range tokens {
    if jsxA11yRoles[token] {
      return
    }
  }
  ctx.Report(node, "Role must be a valid ARIA role.")
}

type jsxA11yAriaUnsupportedElements struct{}

func (jsxA11yAriaUnsupportedElements) Name() string { return "jsx-a11y/aria-unsupported-elements" }
func (jsxA11yAriaUnsupportedElements) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindJsxElement, shimast.KindJsxSelfClosingElement}
}
func (jsxA11yAriaUnsupportedElements) Check(ctx *Context, node *shimast.Node) {
  info := jsxElementFromNode(node)
  switch info.tag {
  case "meta", "html", "script", "style":
    if jsxHasAttr(info.attrs, "role") {
      ctx.Report(info.opening, "This element does not support ARIA roles.")
      return
    }
    for name := range info.attrs {
      if strings.HasPrefix(strings.ToLower(name), "aria-") {
        ctx.Report(info.opening, "This element does not support ARIA attributes.")
        return
      }
    }
  }
}

type jsxA11yAutocompleteValid struct{}

func (jsxA11yAutocompleteValid) Name() string { return "jsx-a11y/autocomplete-valid" }
func (jsxA11yAutocompleteValid) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindJsxElement, shimast.KindJsxSelfClosingElement}
}
func (jsxA11yAutocompleteValid) Check(ctx *Context, node *shimast.Node) {
  info := jsxElementFromNode(node)
  attr, ok := jsxKnownAttr(info.attrs, "autoComplete")
  if !ok {
    attr, ok = jsxKnownAttr(info.attrs, "autocomplete")
  }
  if !ok || strings.TrimSpace(attr.value) == "" {
    return
  }
  for _, token := range strings.Fields(strings.ToLower(attr.value)) {
    if strings.HasPrefix(token, "section-") || token == "shipping" || token == "billing" || token == "home" || token == "work" || token == "mobile" || token == "fax" || token == "pager" {
      continue
    }
    if !jsxAutocompleteTokens[token] {
      ctx.Report(attr.node, "autocomplete contains an invalid token.")
      return
    }
  }
}

type jsxA11yClickEventsHaveKeyEvents struct{}

func (jsxA11yClickEventsHaveKeyEvents) Name() string { return "jsx-a11y/click-events-have-key-events" }
func (jsxA11yClickEventsHaveKeyEvents) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindJsxElement, shimast.KindJsxSelfClosingElement}
}
func (jsxA11yClickEventsHaveKeyEvents) Check(ctx *Context, node *shimast.Node) {
  info := jsxElementFromNode(node)
  // A spread may provide the keyboard handler (or a role/hidden state).
  if info.spread || !jsxHasAttr(info.attrs, "onClick", "onclick") || jsxIsHidden(info) || jsxIsInteractive(info) || jsxHasKeyboardHandler(info.attrs) {
    return
  }
  ctx.Report(info.opening, "Clickable non-interactive elements must also handle keyboard events.")
}

type jsxA11yControlHasAssociatedLabel struct{}

func (jsxA11yControlHasAssociatedLabel) Name() string { return "jsx-a11y/control-has-associated-label" }
func (jsxA11yControlHasAssociatedLabel) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindJsxElement, shimast.KindJsxSelfClosingElement}
}
func (jsxA11yControlHasAssociatedLabel) Check(ctx *Context, node *shimast.Node) {
  info := jsxElementFromNode(node)
  if (jsxIsFormControl(info) || jsxIsInteractive(info)) && !info.spread && !jsxHasAccessibleLabel(info) {
    ctx.Report(info.opening, "Interactive controls must have an accessible label.")
  }
}

type jsxA11yHeadingHasContent struct{}

func (jsxA11yHeadingHasContent) Name() string { return "jsx-a11y/heading-has-content" }
func (jsxA11yHeadingHasContent) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindJsxElement}
}
func (jsxA11yHeadingHasContent) Check(ctx *Context, node *shimast.Node) {
  info := jsxElementFromNode(node)
  switch info.tag {
  case "h1", "h2", "h3", "h4", "h5", "h6":
    if !info.spread && !jsxHasAccessibleLabel(info) {
      ctx.Report(info.opening, "Headings must have accessible content.")
    }
  }
}

type jsxA11yHtmlHasLang struct{}

func (jsxA11yHtmlHasLang) Name() string { return "jsx-a11y/html-has-lang" }
func (jsxA11yHtmlHasLang) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindJsxElement, shimast.KindJsxSelfClosingElement}
}
func (jsxA11yHtmlHasLang) Check(ctx *Context, node *shimast.Node) {
  info := jsxElementFromNode(node)
  if info.tag == "html" && !info.spread && !jsxHasAttr(info.attrs, "lang") {
    ctx.Report(info.opening, "The html element must have a lang attribute.")
  }
}

type jsxA11yIframeHasTitle struct{}

func (jsxA11yIframeHasTitle) Name() string { return "jsx-a11y/iframe-has-title" }
func (jsxA11yIframeHasTitle) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindJsxElement, shimast.KindJsxSelfClosingElement}
}
func (jsxA11yIframeHasTitle) Check(ctx *Context, node *shimast.Node) {
  info := jsxElementFromNode(node)
  if info.tag == "iframe" && !info.spread {
    attr, ok := jsxKnownAttr(info.attrs, "title")
    if !ok || strings.TrimSpace(attr.value) == "" {
      ctx.Report(info.opening, "Iframes must have a non-empty title.")
    }
  }
}

type jsxA11yImgRedundantAlt struct{}

func (jsxA11yImgRedundantAlt) Name() string { return "jsx-a11y/img-redundant-alt" }
func (jsxA11yImgRedundantAlt) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindJsxElement, shimast.KindJsxSelfClosingElement}
}
func (jsxA11yImgRedundantAlt) Check(ctx *Context, node *shimast.Node) {
  info := jsxElementFromNode(node)
  if info.tag != "img" {
    return
  }
  attr, ok := jsxKnownAttr(info.attrs, "alt")
  if !ok {
    return
  }
  value := strings.ToLower(attr.value)
  if strings.Contains(value, "image") || strings.Contains(value, "photo") || strings.Contains(value, "picture") {
    ctx.Report(attr.node, "Image alt text should not contain redundant words like image, photo, or picture.")
  }
}

type jsxA11yInteractiveSupportsFocus struct{}

func (jsxA11yInteractiveSupportsFocus) Name() string { return "jsx-a11y/interactive-supports-focus" }
func (jsxA11yInteractiveSupportsFocus) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindJsxElement, shimast.KindJsxSelfClosingElement}
}
func (jsxA11yInteractiveSupportsFocus) Check(ctx *Context, node *shimast.Node) {
  info := jsxElementFromNode(node)
  if role, ok := jsxRole(info.attrs); ok && jsxInteractiveRoles[role] && !info.spread && !jsxIsFocusable(info) {
    ctx.Report(info.opening, "Elements with interactive roles must be focusable.")
  }
}

type jsxA11yLabelHasAssociatedControl struct{}

func (jsxA11yLabelHasAssociatedControl) Name() string { return "jsx-a11y/label-has-associated-control" }
func (jsxA11yLabelHasAssociatedControl) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindJsxElement}
}
func (jsxA11yLabelHasAssociatedControl) Check(ctx *Context, node *shimast.Node) {
  info := jsxElementFromNode(node)
  if info.tag == "label" && !info.spread && !jsxHasAttr(info.attrs, "htmlFor", "for") && !jsxHasDescendantControl(info.children) {
    ctx.Report(info.opening, "Labels must be associated with a control.")
  }
}

type jsxA11yLabelHasFor struct{}

func (jsxA11yLabelHasFor) Name() string           { return "jsx-a11y/label-has-for" }
func (jsxA11yLabelHasFor) Visits() []shimast.Kind { return []shimast.Kind{shimast.KindJsxElement} }
func (jsxA11yLabelHasFor) Check(ctx *Context, node *shimast.Node) {
  jsxA11yLabelHasAssociatedControl{}.Check(ctx, node)
}

type jsxA11yLang struct{}

func (jsxA11yLang) Name() string { return "jsx-a11y/lang" }
func (jsxA11yLang) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindJsxElement, shimast.KindJsxSelfClosingElement}
}
func (jsxA11yLang) Check(ctx *Context, node *shimast.Node) {
  info := jsxElementFromNode(node)
  attr, ok := jsxKnownAttr(info.attrs, "lang")
  if !ok {
    return
  }
  value := strings.TrimSpace(attr.value)
  parts := strings.Split(value, "-")
  if value == "" || len(parts[0]) < 2 || len(parts[0]) > 3 {
    ctx.Report(attr.node, "lang must be a valid BCP 47 language tag.")
  }
}

type jsxA11yMediaHasCaption struct{}

func (jsxA11yMediaHasCaption) Name() string           { return "jsx-a11y/media-has-caption" }
func (jsxA11yMediaHasCaption) Visits() []shimast.Kind { return []shimast.Kind{shimast.KindJsxElement} }
func (jsxA11yMediaHasCaption) Check(ctx *Context, node *shimast.Node) {
  info := jsxElementFromNode(node)
  if (info.tag == "audio" || info.tag == "video") && !info.spread && !jsxHasTrackCaption(info.children) {
    ctx.Report(info.opening, "Media elements must provide caption tracks.")
  }
}

type jsxA11yMouseEventsHaveKeyEvents struct{}

func (jsxA11yMouseEventsHaveKeyEvents) Name() string { return "jsx-a11y/mouse-events-have-key-events" }
func (jsxA11yMouseEventsHaveKeyEvents) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindJsxElement, shimast.KindJsxSelfClosingElement}
}
func (jsxA11yMouseEventsHaveKeyEvents) Check(ctx *Context, node *shimast.Node) {
  info := jsxElementFromNode(node)
  // The paired focus handler may arrive through a spread.
  if info.spread {
    return
  }
  if jsxHasAttr(info.attrs, "onMouseOver", "onmouseover") && !jsxHasAttr(info.attrs, "onFocus", "onfocus") {
    ctx.Report(info.opening, "onMouseOver must be paired with onFocus.")
    return
  }
  if jsxHasAttr(info.attrs, "onMouseOut", "onmouseout") && !jsxHasAttr(info.attrs, "onBlur", "onblur") {
    ctx.Report(info.opening, "onMouseOut must be paired with onBlur.")
  }
}

type jsxA11yNoAccessKey struct{}

func (jsxA11yNoAccessKey) Name() string           { return "jsx-a11y/no-access-key" }
func (jsxA11yNoAccessKey) Visits() []shimast.Kind { return []shimast.Kind{shimast.KindJsxAttribute} }
func (jsxA11yNoAccessKey) Check(ctx *Context, node *shimast.Node) {
  attr := node.AsJsxAttribute()
  if attr != nil && attr.Name() != nil && jsxAttrName(attr.Name()) == "accessKey" {
    ctx.Report(node, "Do not use accessKey.")
  }
}

type jsxA11yNoAriaHiddenOnFocusable struct{}

func (jsxA11yNoAriaHiddenOnFocusable) Name() string { return "jsx-a11y/no-aria-hidden-on-focusable" }
func (jsxA11yNoAriaHiddenOnFocusable) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindJsxElement, shimast.KindJsxSelfClosingElement}
}
func (jsxA11yNoAriaHiddenOnFocusable) Check(ctx *Context, node *shimast.Node) {
  info := jsxElementFromNode(node)
  if hidden, ok := jsxBoolAttr(info.attrs, "aria-hidden"); ok && hidden && jsxIsFocusable(info) {
    ctx.Report(info.opening, "Focusable elements must not be aria-hidden.")
  }
}

type jsxA11yNoAutofocus struct{}

func (jsxA11yNoAutofocus) Name() string           { return "jsx-a11y/no-autofocus" }
func (jsxA11yNoAutofocus) Visits() []shimast.Kind { return []shimast.Kind{shimast.KindJsxAttribute} }
func (jsxA11yNoAutofocus) Check(ctx *Context, node *shimast.Node) {
  attr := node.AsJsxAttribute()
  if attr == nil || attr.Name() == nil {
    return
  }
  name := jsxAttrName(attr.Name())
  if name == "autoFocus" || name == "autofocus" {
    ctx.Report(node, "Do not use autoFocus.")
  }
}

type jsxA11yNoDistractingElements struct{}

func (jsxA11yNoDistractingElements) Name() string { return "jsx-a11y/no-distracting-elements" }
func (jsxA11yNoDistractingElements) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindJsxElement, shimast.KindJsxSelfClosingElement}
}
func (jsxA11yNoDistractingElements) Check(ctx *Context, node *shimast.Node) {
  info := jsxElementFromNode(node)
  if info.tag == "blink" || info.tag == "marquee" {
    ctx.Report(info.opening, "Do not use distracting elements.")
  }
}

type jsxA11yNoInteractiveElementToNoninteractiveRole struct{}

func (jsxA11yNoInteractiveElementToNoninteractiveRole) Name() string {
  return "jsx-a11y/no-interactive-element-to-noninteractive-role"
}
func (jsxA11yNoInteractiveElementToNoninteractiveRole) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindJsxElement, shimast.KindJsxSelfClosingElement}
}
func (jsxA11yNoInteractiveElementToNoninteractiveRole) Check(ctx *Context, node *shimast.Node) {
  info := jsxElementFromNode(node)
  role, ok := jsxRole(info.attrs)
  if ok && jsxIsInteractive(info) && jsxNonInteractiveRoles[role] {
    ctx.Report(info.opening, "Interactive elements must not use non-interactive roles.")
  }
}

type jsxA11yNoNoninteractiveElementInteractions struct{}

func (jsxA11yNoNoninteractiveElementInteractions) Name() string {
  return "jsx-a11y/no-noninteractive-element-interactions"
}
func (jsxA11yNoNoninteractiveElementInteractions) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindJsxElement, shimast.KindJsxSelfClosingElement}
}
func (jsxA11yNoNoninteractiveElementInteractions) Check(ctx *Context, node *shimast.Node) {
  info := jsxElementFromNode(node)
  if jsxIsNonInteractiveElement(info.tag) && jsxHasMouseOrKeyboardInteraction(info.attrs) {
    ctx.Report(info.opening, "Non-interactive elements must not have interaction handlers.")
  }
}

type jsxA11yNoNoninteractiveElementToInteractiveRole struct{}

func (jsxA11yNoNoninteractiveElementToInteractiveRole) Name() string {
  return "jsx-a11y/no-noninteractive-element-to-interactive-role"
}
func (jsxA11yNoNoninteractiveElementToInteractiveRole) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindJsxElement, shimast.KindJsxSelfClosingElement}
}
func (jsxA11yNoNoninteractiveElementToInteractiveRole) Check(ctx *Context, node *shimast.Node) {
  info := jsxElementFromNode(node)
  role, ok := jsxRole(info.attrs)
  if ok && jsxIsNonInteractiveElement(info.tag) && jsxInteractiveRoles[role] {
    ctx.Report(info.opening, "Non-interactive elements must not use interactive roles.")
  }
}

type jsxA11yNoNoninteractiveTabindex struct{}

func (jsxA11yNoNoninteractiveTabindex) Name() string { return "jsx-a11y/no-noninteractive-tabindex" }
func (jsxA11yNoNoninteractiveTabindex) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindJsxElement, shimast.KindJsxSelfClosingElement}
}
func (jsxA11yNoNoninteractiveTabindex) Check(ctx *Context, node *shimast.Node) {
  info := jsxElementFromNode(node)
  // A spread may provide an interactive role that legitimizes the tabIndex.
  if _, ok := jsxNumericAttr(info.attrs, "tabIndex", "tabindex"); ok && !info.spread && !jsxIsInteractive(info) {
    ctx.Report(info.opening, "Non-interactive elements must not be focusable with tabIndex.")
  }
}

type jsxA11yNoRedundantRoles struct{}

func (jsxA11yNoRedundantRoles) Name() string { return "jsx-a11y/no-redundant-roles" }
func (jsxA11yNoRedundantRoles) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindJsxElement, shimast.KindJsxSelfClosingElement}
}
func (jsxA11yNoRedundantRoles) Check(ctx *Context, node *shimast.Node) {
  info := jsxElementFromNode(node)
  role, ok := jsxRole(info.attrs)
  if !ok {
    return
  }
  implicit := jsxImplicitRole(info)
  if implicit == "" {
    implicit = jsxRedundantRoles[info.tag]
  }
  if implicit == role {
    ctx.Report(info.opening, "This role is redundant on the element.")
  }
}

type jsxA11yNoStaticElementInteractions struct{}

func (jsxA11yNoStaticElementInteractions) Name() string {
  return "jsx-a11y/no-static-element-interactions"
}
func (jsxA11yNoStaticElementInteractions) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindJsxElement, shimast.KindJsxSelfClosingElement}
}
func (jsxA11yNoStaticElementInteractions) Check(ctx *Context, node *shimast.Node) {
  info := jsxElementFromNode(node)
  // A spread may provide the required ARIA role.
  if info.tag == "" || info.spread || jsxIsInteractive(info) || jsxIsNonInteractiveElement(info.tag) || jsxHasAttr(info.attrs, "role") || !jsxHasMouseOrKeyboardInteraction(info.attrs) {
    return
  }
  ctx.Report(info.opening, "Static elements with interaction handlers must have an ARIA role.")
}

type jsxA11yPreferTagOverRole struct{}

func (jsxA11yPreferTagOverRole) Name() string { return "jsx-a11y/prefer-tag-over-role" }
func (jsxA11yPreferTagOverRole) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindJsxElement, shimast.KindJsxSelfClosingElement}
}
func (jsxA11yPreferTagOverRole) Check(ctx *Context, node *shimast.Node) {
  info := jsxElementFromNode(node)
  if info.tag == "" || info.tag != "div" && info.tag != "span" {
    return
  }
  role, ok := jsxRole(info.attrs)
  if ok {
    if tag, exists := jsxRolePreferredTag[role]; exists {
      ctx.Report(info.opening, "Prefer the native "+tag+" element over role="+role+".")
    }
  }
}

type jsxA11yRoleHasRequiredAriaProps struct{}

func (jsxA11yRoleHasRequiredAriaProps) Name() string { return "jsx-a11y/role-has-required-aria-props" }
func (jsxA11yRoleHasRequiredAriaProps) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindJsxElement, shimast.KindJsxSelfClosingElement}
}
func (jsxA11yRoleHasRequiredAriaProps) Check(ctx *Context, node *shimast.Node) {
  info := jsxElementFromNode(node)
  role, ok := jsxRole(info.attrs)
  if !ok {
    return
  }
  // The required ARIA props may arrive through a spread.
  if info.spread {
    return
  }
  for _, required := range jsxRoleRequiredProps[role] {
    if !jsxHasAttr(info.attrs, required) {
      ctx.Report(info.opening, "Role "+role+" requires "+required+".")
      return
    }
  }
}

type jsxA11yRoleSupportsAriaProps struct{}

func (jsxA11yRoleSupportsAriaProps) Name() string { return "jsx-a11y/role-supports-aria-props" }
func (jsxA11yRoleSupportsAriaProps) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindJsxElement, shimast.KindJsxSelfClosingElement}
}
func (jsxA11yRoleSupportsAriaProps) Check(ctx *Context, node *shimast.Node) {
  info := jsxElementFromNode(node)
  role, ok := jsxRole(info.attrs)
  if !ok {
    return
  }
  if role == "" {
    return
  }
  supported := jsxRoleSupportedProps[role]
  for name, attr := range info.attrs {
    lower := strings.ToLower(name)
    if !strings.HasPrefix(lower, "aria-") || !jsxAriaProps[lower] || jsxGlobalAriaProps[lower] {
      continue
    }
    if supported == nil || !supported[lower] {
      ctx.Report(attr.node, "ARIA property "+lower+" is not supported by role "+role+".")
      return
    }
  }
}

type jsxA11yScope struct{}

func (jsxA11yScope) Name() string { return "jsx-a11y/scope" }
func (jsxA11yScope) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindJsxElement, shimast.KindJsxSelfClosingElement}
}
func (jsxA11yScope) Check(ctx *Context, node *shimast.Node) {
  info := jsxElementFromNode(node)
  if jsxHasAttr(info.attrs, "scope") && info.tag != "th" {
    ctx.Report(info.opening, "The scope attribute is only valid on th elements.")
  }
}

type jsxA11yTabindexNoPositive struct{}

func (jsxA11yTabindexNoPositive) Name() string { return "jsx-a11y/tabindex-no-positive" }
func (jsxA11yTabindexNoPositive) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindJsxElement, shimast.KindJsxSelfClosingElement}
}
func (jsxA11yTabindexNoPositive) Check(ctx *Context, node *shimast.Node) {
  info := jsxElementFromNode(node)
  if value, ok := jsxNumericAttr(info.attrs, "tabIndex", "tabindex"); ok && value > 0 {
    ctx.Report(info.opening, "tabIndex must not be positive.")
  }
}

// jsxA11yAnchorAmbiguousText reports `<a>` elements whose visible text
// is one of a small set of phrases that carry no information out of
// context. Screen-reader users frequently navigate by listing all
// links; "click here" / "more" / "read more" turn that list into
// uninformative noise.
// https://github.com/jsx-eslint/eslint-plugin-jsx-a11y/blob/main/docs/rules/anchor-ambiguous-text.md
type jsxA11yAnchorAmbiguousText struct{}

func (jsxA11yAnchorAmbiguousText) Name() string { return "jsx-a11y/anchor-ambiguous-text" }
func (jsxA11yAnchorAmbiguousText) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindJsxElement}
}
func (jsxA11yAnchorAmbiguousText) Check(ctx *Context, node *shimast.Node) {
  info := jsxElementFromNode(node)
  if info.tag != "a" {
    return
  }
  text := strings.ToLower(strings.TrimSpace(jsxAnchorText(info.children)))
  if text == "" {
    return
  }
  switch text {
  case "click here", "here", "link", "a link", "click", "more", "read more":
    ctx.Report(info.opening, "Anchor text \""+text+"\" is too ambiguous out of context; describe the destination.")
  }
}

// jsxAnchorText concatenates the visible text content of a JSX
// element's children. Nested JSX is recursively concatenated. JSX
// expressions that wrap a plain string literal contribute their literal
// text; other expression shapes are skipped because their runtime value
// is not known at lint time.
func jsxAnchorText(children *shimast.NodeList) string {
  if children == nil {
    return ""
  }
  var b strings.Builder
  for _, child := range children.Nodes {
    if child == nil {
      continue
    }
    switch child.Kind {
    case shimast.KindJsxText:
      t := child.AsJsxText()
      if t != nil && !t.ContainsOnlyTriviaWhiteSpaces {
        b.WriteString(t.Text)
      }
    case shimast.KindJsxExpression:
      expr := child.AsJsxExpression()
      if expr != nil && expr.Expression != nil {
        if s := stringLiteralText(expr.Expression); s != "" {
          b.WriteString(s)
        }
      }
    case shimast.KindJsxElement:
      inner := jsxElementFromNode(child)
      b.WriteString(jsxAnchorText(inner.children))
    }
  }
  return b.String()
}

func init() {
  Register(jsxA11yAltText{})
  Register(jsxA11yAnchorAmbiguousText{})
  Register(jsxA11yAnchorHasContent{})
  Register(jsxA11yAnchorIsValid{})
  Register(jsxA11yAriaActivedescendantHasTabindex{})
  Register(jsxA11yAriaProps{})
  Register(jsxA11yAriaProptypes{})
  Register(jsxA11yAriaRole{})
  Register(jsxA11yAriaUnsupportedElements{})
  Register(jsxA11yAutocompleteValid{})
  Register(jsxA11yClickEventsHaveKeyEvents{})
  Register(jsxA11yControlHasAssociatedLabel{})
  Register(jsxA11yHeadingHasContent{})
  Register(jsxA11yHtmlHasLang{})
  Register(jsxA11yIframeHasTitle{})
  Register(jsxA11yImgRedundantAlt{})
  Register(jsxA11yInteractiveSupportsFocus{})
  Register(jsxA11yLabelHasAssociatedControl{})
  Register(jsxA11yLabelHasFor{})
  Register(jsxA11yLang{})
  Register(jsxA11yMediaHasCaption{})
  Register(jsxA11yMouseEventsHaveKeyEvents{})
  Register(jsxA11yNoAccessKey{})
  Register(jsxA11yNoAriaHiddenOnFocusable{})
  Register(jsxA11yNoAutofocus{})
  Register(jsxA11yNoDistractingElements{})
  Register(jsxA11yNoInteractiveElementToNoninteractiveRole{})
  Register(jsxA11yNoNoninteractiveElementInteractions{})
  Register(jsxA11yNoNoninteractiveElementToInteractiveRole{})
  Register(jsxA11yNoNoninteractiveTabindex{})
  Register(jsxA11yNoRedundantRoles{})
  Register(jsxA11yNoStaticElementInteractions{})
  Register(jsxA11yPreferTagOverRole{})
  Register(jsxA11yRoleHasRequiredAriaProps{})
  Register(jsxA11yRoleSupportsAriaProps{})
  Register(jsxA11yScope{})
  Register(jsxA11yTabindexNoPositive{})
}
