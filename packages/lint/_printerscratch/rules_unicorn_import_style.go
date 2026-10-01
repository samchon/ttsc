// unicorn/import-style: enforce specific import styles per module. A
// module's allowed styles (`unassigned`, `default`, `namespace`,
// `named`) come from the merged default table (`chalk`/`path` are
// default-only, `util` is named-only) and the user's `styles` option;
// static imports, dynamic imports, `export … from`, and `require`
// calls are classified into actual styles and reported when any of
// them falls outside the module's allowed set. `node:`-prefixed
// specifiers inherit the bare module's configuration while diagnostics
// keep the spelling the source used.
//
// Mirrors upstream's ESTree listeners: `import` declarations and
// unassigned dynamic imports / `require` statements are checked
// directly, while `const … = await import(…)` and `const … =
// require(…)` classify the declarator's binding target. Module names
// resolve through a static-string evaluator covering literals,
// parenthesized expressions, `+` concatenation, and template literals
// whose substitutions are themselves static strings; upstream's
// scope-based constant folding is intentionally out of scope, matching
// the literal-only convention of the other import rules in this host.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/import-style.md
package linthost

import (
  "bytes"
  "encoding/json"
  "errors"
  "fmt"
  "strings"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

type unicornImportStyle struct{ optionsRule }

const (
  unicornImportStyleUnassigned = "unassigned"
  unicornImportStyleDefault    = "default"
  unicornImportStyleNamespace  = "namespace"
  unicornImportStyleNamed      = "named"
)

// unicornImportStyleCanonicalStyles lists the four style names a module
// configuration must set to `false`, one and all, to count as banned.
var unicornImportStyleCanonicalStyles = []string{
  unicornImportStyleUnassigned,
  unicornImportStyleDefault,
  unicornImportStyleNamespace,
  unicornImportStyleNamed,
}

// unicornImportStyleStylePair is one `style: allowed` entry of a module
// configuration. Order is preserved because the diagnostic lists the
// allowed styles in configuration order, exactly like upstream's
// JavaScript object spread.
type unicornImportStyleStylePair struct {
  style   string
  allowed bool
}

// unicornImportStyleDefaultStyles mirrors upstream's built-in table.
// Keep this alphabetically sorted for easier maintenance.
var unicornImportStyleDefaultStyles = map[string][]unicornImportStyleStylePair{
  "chalk": {{style: unicornImportStyleDefault, allowed: true}},
  "path":  {{style: unicornImportStyleDefault, allowed: true}},
  "util":  {{style: unicornImportStyleNamed, allowed: true}},
}

var unicornImportStyleDefaultStyleNames = []string{"chalk", "path", "util"}

// unicornImportStyleModule is one module's resolved policy: the ordered
// allowed styles and whether every canonical style was explicitly
// disabled (the misuse upstream reports with a dedicated message).
type unicornImportStyleModule struct {
  allowed []string
  banned  bool
}

type unicornImportStyleOptions struct {
  checkImport        bool
  checkDynamicImport bool
  checkExportFrom    bool
  checkRequire       bool
  styles             map[string]unicornImportStyleModule
}

// unicornImportStyleUserModule captures one raw `styles` entry before
// merging: `false` disables the module's restrictions, an object lists
// per-style booleans in declaration order.
type unicornImportStyleUserModule struct {
  disabled bool
  pairs    []unicornImportStyleStylePair
}

func (unicornImportStyle) Name() string { return "unicorn/import-style" }
func (unicornImportStyle) Visits() []shimast.Kind {
  return []shimast.Kind{
    shimast.KindImportDeclaration,
    shimast.KindExportDeclaration,
    shimast.KindCallExpression,
    shimast.KindVariableDeclaration,
  }
}

func (unicornImportStyle) ValidateOptions(raw json.RawMessage) error {
  _, err := parseUnicornImportStyleOptions(raw)
  return err
}

func (unicornImportStyle) Check(ctx *Context, node *shimast.Node) {
  if ctx == nil || node == nil {
    return
  }
  options, err := parseUnicornImportStyleOptions(ctx.Options)
  if err != nil || len(options.styles) == 0 {
    return
  }
  switch node.Kind {
  case shimast.KindImportDeclaration:
    if options.checkImport {
      checkUnicornImportStyleImportDeclaration(ctx, node, options)
    }
  case shimast.KindExportDeclaration:
    if options.checkExportFrom {
      checkUnicornImportStyleExportDeclaration(ctx, node, options)
    }
  case shimast.KindCallExpression:
    checkUnicornImportStyleCallExpression(ctx, node, options)
  case shimast.KindVariableDeclaration:
    checkUnicornImportStyleVariableDeclaration(ctx, node, options)
  }
}

func parseUnicornImportStyleOptions(raw json.RawMessage) (unicornImportStyleOptions, error) {
  options := unicornImportStyleOptions{
    checkImport:        true,
    checkDynamicImport: true,
    checkRequire:       true,
  }
  extendDefaultStyles := true
  var userStyles map[string]unicornImportStyleUserModule
  trimmed := bytes.TrimSpace(raw)
  if len(trimmed) != 0 {
    if trimmed[0] != '{' {
      return options, errors.New("options must be an object")
    }
    var fields map[string]json.RawMessage
    if err := json.Unmarshal(trimmed, &fields); err != nil {
      return options, fmt.Errorf("options must be an object: %w", err)
    }
    for name, value := range fields {
      var err error
      switch name {
      case "checkImport":
        options.checkImport, err = unicornImportStyleDecodeBool(value, name)
      case "checkDynamicImport":
        options.checkDynamicImport, err = unicornImportStyleDecodeBool(value, name)
      case "checkExportFrom":
        options.checkExportFrom, err = unicornImportStyleDecodeBool(value, name)
      case "checkRequire":
        options.checkRequire, err = unicornImportStyleDecodeBool(value, name)
      case "extendDefaultStyles":
        extendDefaultStyles, err = unicornImportStyleDecodeBool(value, name)
      case "styles":
        userStyles, err = parseUnicornImportStyleStyles(value)
      default:
        err = fmt.Errorf("unknown option %q", name)
      }
      if err != nil {
        return options, err
      }
    }
  }
  options.styles = resolveUnicornImportStyleStyles(userStyles, extendDefaultStyles)
  return options, nil
}

func unicornImportStyleDecodeBool(raw json.RawMessage, name string) (bool, error) {
  var decoded any
  if err := json.Unmarshal(raw, &decoded); err != nil {
    return false, fmt.Errorf("option %q must be a boolean", name)
  }
  value, ok := decoded.(bool)
  if !ok {
    return false, fmt.Errorf("option %q must be a boolean", name)
  }
  return value, nil
}

func parseUnicornImportStyleStyles(raw json.RawMessage) (map[string]unicornImportStyleUserModule, error) {
  trimmed := bytes.TrimSpace(raw)
  if len(trimmed) == 0 || trimmed[0] != '{' {
    return nil, fmt.Errorf("option %q must be an object", "styles")
  }
  var modules map[string]json.RawMessage
  if err := json.Unmarshal(trimmed, &modules); err != nil {
    return nil, fmt.Errorf("option %q must be an object", "styles")
  }
  parsed := make(map[string]unicornImportStyleUserModule, len(modules))
  for name, rawModule := range modules {
    value := bytes.TrimSpace(rawModule)
    if bytes.Equal(value, []byte("false")) {
      parsed[name] = unicornImportStyleUserModule{disabled: true}
      continue
    }
    if len(value) == 0 || value[0] != '{' {
      return nil, fmt.Errorf("styles entry %q must be false or an object of booleans", name)
    }
    pairs, err := unicornImportStyleDecodeOrderedBooleans(value, name)
    if err != nil {
      return nil, err
    }
    parsed[name] = unicornImportStyleUserModule{pairs: pairs}
  }
  return parsed, nil
}

// unicornImportStyleDecodeOrderedBooleans reads one module's style
// object while preserving key order. encoding/json maps are unordered,
// but the diagnostic message lists allowed styles in declaration order,
// so the pairs are decoded token by token. A duplicated key keeps its
// first position and takes the last value, mirroring JSON.parse.
func unicornImportStyleDecodeOrderedBooleans(raw []byte, moduleName string) ([]unicornImportStyleStylePair, error) {
  decoder := json.NewDecoder(bytes.NewReader(raw))
  if token, err := decoder.Token(); err != nil || token != json.Delim('{') {
    return nil, fmt.Errorf("styles entry %q must be false or an object of booleans", moduleName)
  }
  var pairs []unicornImportStyleStylePair
  for decoder.More() {
    keyToken, err := decoder.Token()
    if err != nil {
      return nil, fmt.Errorf("styles entry %q must be false or an object of booleans", moduleName)
    }
    key, ok := keyToken.(string)
    if !ok {
      return nil, fmt.Errorf("styles entry %q must be false or an object of booleans", moduleName)
    }
    var decoded any
    if err := decoder.Decode(&decoded); err != nil {
      return nil, fmt.Errorf("style %q of module %q must be a boolean", key, moduleName)
    }
    value, isBool := decoded.(bool)
    if !isBool {
      return nil, fmt.Errorf("style %q of module %q must be a boolean", key, moduleName)
    }
    pairs = unicornImportStyleUpsertPair(pairs, key, value)
  }
  if token, err := decoder.Token(); err != nil || token != json.Delim('}') {
    return nil, fmt.Errorf("styles entry %q must be false or an object of booleans", moduleName)
  }
  return pairs, nil
}

func unicornImportStyleUpsertPair(
  pairs []unicornImportStyleStylePair,
  style string,
  allowed bool,
) []unicornImportStyleStylePair {
  for index := range pairs {
    if pairs[index].style == style {
      pairs[index].allowed = allowed
      return pairs
    }
  }
  return append(pairs, unicornImportStyleStylePair{style: style, allowed: allowed})
}

// resolveUnicornImportStyleStyles folds the default table and the
// user's `styles` into the final per-module policy, mirroring
// upstream's object spread: with `extendDefaultStyles` the defaults
// seed each shared module and user entries override style by style,
// while `moduleName: false` clears the module's restrictions entirely.
func resolveUnicornImportStyleStyles(
  userStyles map[string]unicornImportStyleUserModule,
  extendDefaultStyles bool,
) map[string]unicornImportStyleModule {
  names := make([]string, 0, len(unicornImportStyleDefaultStyleNames)+len(userStyles))
  if extendDefaultStyles {
    names = append(names, unicornImportStyleDefaultStyleNames...)
  }
  for name := range userStyles {
    if !extendDefaultStyles || unicornImportStyleDefaultStyles[name] == nil {
      names = append(names, name)
    }
  }
  resolved := make(map[string]unicornImportStyleModule, len(names))
  for _, name := range names {
    user, hasUser := userStyles[name]
    if hasUser && user.disabled {
      resolved[name] = unicornImportStyleModule{}
      continue
    }
    var pairs []unicornImportStyleStylePair
    if extendDefaultStyles {
      pairs = append(pairs, unicornImportStyleDefaultStyles[name]...)
    }
    for _, pair := range user.pairs {
      pairs = unicornImportStyleUpsertPair(pairs, pair.style, pair.allowed)
    }
    resolved[name] = unicornImportStyleFinalizeModule(pairs)
  }
  return resolved
}

func unicornImportStyleFinalizeModule(pairs []unicornImportStyleStylePair) unicornImportStyleModule {
  module := unicornImportStyleModule{}
  for _, pair := range pairs {
    if pair.allowed {
      module.allowed = append(module.allowed, pair.style)
    }
  }
  banned := true
  for _, style := range unicornImportStyleCanonicalStyles {
    explicitlyFalse := false
    for _, pair := range pairs {
      if pair.style == style {
        explicitlyFalse = !pair.allowed
        break
      }
    }
    if !explicitlyFalse {
      banned = false
      break
    }
  }
  module.banned = banned
  return module
}

func checkUnicornImportStyleImportDeclaration(ctx *Context, node *shimast.Node, options unicornImportStyleOptions) {
  declaration := node.AsImportDeclaration()
  if declaration == nil {
    return
  }
  moduleName, ok := unicornImportStyleStaticString(declaration.ModuleSpecifier)
  if !ok {
    return
  }
  styles := unicornImportStyleImportDeclarationStyles(declaration)
  reportUnicornImportStyle(ctx, node, moduleName, styles, false, options)
}

// unicornImportStyleImportDeclarationStyles classifies one static
// import the way upstream reads ESTree specifiers: no specifiers is
// the unassigned style, a default binding or a named `default` alias
// is the default style, `* as ns` is namespace, and every other named
// specifier is named.
func unicornImportStyleImportDeclarationStyles(declaration *shimast.ImportDeclaration) []string {
  clauseNode := declaration.ImportClause
  if clauseNode == nil {
    return []string{unicornImportStyleUnassigned}
  }
  clause := clauseNode.AsImportClause()
  if clause == nil {
    return []string{unicornImportStyleUnassigned}
  }
  var styles []string
  if clause.Name() != nil {
    styles = unicornImportStyleAppend(styles, unicornImportStyleDefault)
  }
  if bindings := clause.NamedBindings; bindings != nil {
    switch bindings.Kind {
    case shimast.KindNamespaceImport:
      styles = unicornImportStyleAppend(styles, unicornImportStyleNamespace)
    case shimast.KindNamedImports:
      if named := bindings.AsNamedImports(); named != nil && named.Elements != nil {
        for _, element := range named.Elements.Nodes {
          specifier := element.AsImportSpecifier()
          if specifier == nil {
            continue
          }
          imported := specifier.PropertyName
          if imported == nil {
            imported = specifier.Name()
          }
          if identifierText(imported) == "default" {
            styles = unicornImportStyleAppend(styles, unicornImportStyleDefault)
          } else {
            styles = unicornImportStyleAppend(styles, unicornImportStyleNamed)
          }
        }
      }
    }
  }
  if len(styles) == 0 {
    return []string{unicornImportStyleUnassigned}
  }
  return styles
}

func checkUnicornImportStyleExportDeclaration(ctx *Context, node *shimast.Node, options unicornImportStyleOptions) {
  declaration := node.AsExportDeclaration()
  if declaration == nil || declaration.ModuleSpecifier == nil {
    return
  }
  moduleName, ok := unicornImportStyleStaticString(declaration.ModuleSpecifier)
  if !ok {
    return
  }
  var styles []string
  clause := declaration.ExportClause
  switch {
  case clause == nil || clause.Kind == shimast.KindNamespaceExport:
    // `export * from` and `export * as ns from` are upstream's
    // ExportAllDeclaration: always the namespace style.
    styles = []string{unicornImportStyleNamespace}
  case clause.Kind == shimast.KindNamedExports:
    named := clause.AsNamedExports()
    if named == nil || named.Elements == nil || len(named.Elements.Nodes) == 0 {
      styles = []string{unicornImportStyleUnassigned}
      break
    }
    for _, element := range named.Elements.Nodes {
      specifier := element.AsExportSpecifier()
      if specifier == nil {
        continue
      }
      // Upstream classifies by the exported (outer) name, so
      // `export {x as default} from "m"` is the default style.
      if identifierText(specifier.Name()) == "default" {
        styles = unicornImportStyleAppend(styles, unicornImportStyleDefault)
      } else {
        styles = unicornImportStyleAppend(styles, unicornImportStyleNamed)
      }
    }
  default:
    return
  }
  reportUnicornImportStyle(ctx, node, moduleName, styles, false, options)
}

func checkUnicornImportStyleCallExpression(ctx *Context, node *shimast.Node, options unicornImportStyleOptions) {
  call := node.AsCallExpression()
  if call == nil || call.Expression == nil {
    return
  }
  if call.Expression.Kind == shimast.KindImportKeyword {
    if !options.checkDynamicImport || unicornImportStyleIsAssignedDynamicImport(node) {
      return
    }
    moduleName, ok := unicornImportStyleStaticString(unicornImportStyleFirstArgument(call))
    if !ok {
      return
    }
    reportUnicornImportStyle(ctx, node, moduleName, []string{unicornImportStyleUnassigned}, false, options)
    return
  }
  if !options.checkRequire {
    return
  }
  // Upstream's unassigned-require listener matches the exact
  // statement-level shape: a non-optional bare `require` call with one
  // argument whose parent is the expression statement itself.
  if call.QuestionDotToken != nil || identifierText(stripParens(call.Expression)) != "require" {
    return
  }
  if call.Arguments == nil || len(call.Arguments.Nodes) != 1 {
    return
  }
  parent, child := unicornImportStyleEffectiveParent(node)
  if parent == nil || parent.Kind != shimast.KindExpressionStatement {
    return
  }
  statement := parent.AsExpressionStatement()
  if statement == nil || statement.Expression != child {
    return
  }
  moduleName, ok := unicornImportStyleStaticString(call.Arguments.Nodes[0])
  if !ok {
    return
  }
  reportUnicornImportStyle(ctx, node, moduleName, []string{unicornImportStyleUnassigned}, true, options)
}

func checkUnicornImportStyleVariableDeclaration(ctx *Context, node *shimast.Node, options unicornImportStyleOptions) {
  declaration := node.AsVariableDeclaration()
  if declaration == nil || declaration.Initializer == nil {
    return
  }
  initializer := stripParens(declaration.Initializer)
  if initializer == nil {
    return
  }
  if initializer.Kind == shimast.KindAwaitExpression {
    if !options.checkDynamicImport {
      return
    }
    await := initializer.AsAwaitExpression()
    if await == nil {
      return
    }
    call := unicornImportStyleDynamicImportCall(await.Expression)
    if call == nil {
      return
    }
    moduleName, ok := unicornImportStyleStaticString(unicornImportStyleFirstArgument(call))
    if !ok || moduleName == "" {
      return
    }
    styles := unicornImportStyleAssignmentTargetStyles(declaration.Name())
    reportUnicornImportStyle(ctx, node, moduleName, styles, false, options)
    return
  }
  if !options.checkRequire || initializer.Kind != shimast.KindCallExpression {
    return
  }
  call := initializer.AsCallExpression()
  if call == nil || identifierText(stripParens(call.Expression)) != "require" {
    return
  }
  // ESTree wraps `require?.(…)` in a ChainExpression, so upstream's
  // `init.type === 'CallExpression'` listener never classifies an
  // optional require declarator. QuestionDotToken is the tsgo AST's
  // equivalent of that wrapper.
  if call.QuestionDotToken != nil {
    return
  }
  moduleName, ok := unicornImportStyleStaticString(unicornImportStyleFirstArgument(call))
  if !ok || moduleName == "" {
    return
  }
  styles := unicornImportStyleAssignmentTargetStyles(declaration.Name())
  reportUnicornImportStyle(ctx, node, moduleName, styles, true, options)
}

// unicornImportStyleDynamicImportCall returns the `import(…)` call
// behind `expression`, or nil when the expression is anything else.
func unicornImportStyleDynamicImportCall(expression *shimast.Node) *shimast.CallExpression {
  expression = stripParens(expression)
  if expression == nil || expression.Kind != shimast.KindCallExpression {
    return nil
  }
  call := expression.AsCallExpression()
  if call == nil || call.Expression == nil || call.Expression.Kind != shimast.KindImportKeyword {
    return nil
  }
  return call
}

func unicornImportStyleFirstArgument(call *shimast.CallExpression) *shimast.Node {
  if call == nil || call.Arguments == nil || len(call.Arguments.Nodes) == 0 {
    return nil
  }
  return call.Arguments.Nodes[0]
}

// unicornImportStyleIsAssignedDynamicImport mirrors upstream's
// isAssignedDynamicImport: `const x = await import("m")` is handled by
// the declarator path, so the bare dynamic-import listener skips an
// import expression awaited directly inside a declarator initializer.
func unicornImportStyleIsAssignedDynamicImport(importCall *shimast.Node) bool {
  parent, child := unicornImportStyleEffectiveParent(importCall)
  if parent == nil || parent.Kind != shimast.KindAwaitExpression {
    return false
  }
  await := parent.AsAwaitExpression()
  if await == nil || await.Expression != child {
    return false
  }
  grandparent, awaited := unicornImportStyleEffectiveParent(parent)
  if grandparent == nil || grandparent.Kind != shimast.KindVariableDeclaration {
    return false
  }
  declaration := grandparent.AsVariableDeclaration()
  return declaration != nil && stripParens(declaration.Initializer) == stripParens(awaited)
}

// unicornImportStyleEffectiveParent walks upward through parenthesized
// expressions and returns the first structural ancestor plus the child
// slot it holds, because ESTree (upstream's AST) has no parenthesized
// nodes at all.
func unicornImportStyleEffectiveParent(node *shimast.Node) (*shimast.Node, *shimast.Node) {
  current := node
  parent := node.Parent
  for parent != nil && parent.Kind == shimast.KindParenthesizedExpression {
    wrapper := parent.AsParenthesizedExpression()
    if wrapper == nil || wrapper.Expression != current {
      break
    }
    current = parent
    parent = parent.Parent
  }
  return parent, current
}

// unicornImportStyleAssignmentTargetStyles classifies the binding
// target of an awaited dynamic import or a `require` declarator:
// identifiers and array patterns take the whole namespace, an empty
// object pattern is unassigned, and object-pattern properties are the
// default style for `default` keys, named otherwise (rest elements
// included).
func unicornImportStyleAssignmentTargetStyles(target *shimast.Node) []string {
  if target == nil {
    return nil
  }
  switch target.Kind {
  case shimast.KindIdentifier, shimast.KindArrayBindingPattern:
    return []string{unicornImportStyleNamespace}
  case shimast.KindObjectBindingPattern:
    pattern := target.AsBindingPattern()
    if pattern == nil || pattern.Elements == nil || len(pattern.Elements.Nodes) == 0 {
      return []string{unicornImportStyleUnassigned}
    }
    var styles []string
    for _, elementNode := range pattern.Elements.Nodes {
      element := elementNode.AsBindingElement()
      if element == nil {
        continue
      }
      if element.DotDotDotToken != nil {
        styles = unicornImportStyleAppend(styles, unicornImportStyleNamed)
        continue
      }
      key := element.PropertyName
      if key == nil {
        key = element.Name()
      }
      if key != nil && key.Kind == shimast.KindComputedPropertyName {
        if computed := key.AsComputedPropertyName(); computed != nil {
          key = stripParens(computed.Expression)
        }
      }
      if key == nil || key.Kind != shimast.KindIdentifier {
        // Upstream only classifies identifier keys; literal keys such
        // as `{"x": y}` contribute no style at all.
        continue
      }
      if identifierText(key) == "default" {
        styles = unicornImportStyleAppend(styles, unicornImportStyleDefault)
      } else {
        styles = unicornImportStyleAppend(styles, unicornImportStyleNamed)
      }
    }
    return styles
  }
  return nil
}

func unicornImportStyleAppend(styles []string, style string) []string {
  for _, existing := range styles {
    if existing == style {
      return styles
    }
  }
  return append(styles, style)
}

// unicornImportStyleStaticString evaluates a compile-time-constant
// string expression: string literals, no-substitution templates,
// parenthesized expressions, `+` concatenations of static strings, and
// template literals whose substitutions are static strings.
func unicornImportStyleStaticString(node *shimast.Node) (string, bool) {
  node = stripParens(node)
  if node == nil {
    return "", false
  }
  switch node.Kind {
  case shimast.KindStringLiteral:
    if literal := node.AsStringLiteral(); literal != nil {
      return literal.Text, true
    }
  case shimast.KindNoSubstitutionTemplateLiteral:
    if literal := node.AsNoSubstitutionTemplateLiteral(); literal != nil {
      return literal.Text, true
    }
  case shimast.KindTemplateExpression:
    template := node.AsTemplateExpression()
    if template == nil || template.Head == nil || template.TemplateSpans == nil {
      return "", false
    }
    head := template.Head.AsTemplateHead()
    if head == nil {
      return "", false
    }
    var builder strings.Builder
    builder.WriteString(head.Text)
    for _, spanNode := range template.TemplateSpans.Nodes {
      span := spanNode.AsTemplateSpan()
      if span == nil {
        return "", false
      }
      value, ok := unicornImportStyleStaticString(span.Expression)
      if !ok || span.Literal == nil {
        return "", false
      }
      builder.WriteString(value)
      switch span.Literal.Kind {
      case shimast.KindTemplateMiddle:
        middle := span.Literal.AsTemplateMiddle()
        if middle == nil {
          return "", false
        }
        builder.WriteString(middle.Text)
      case shimast.KindTemplateTail:
        tail := span.Literal.AsTemplateTail()
        if tail == nil {
          return "", false
        }
        builder.WriteString(tail.Text)
      default:
        return "", false
      }
    }
    return builder.String(), true
  case shimast.KindBinaryExpression:
    binary := node.AsBinaryExpression()
    if binary == nil || binary.OperatorToken == nil ||
      binary.OperatorToken.Kind != shimast.KindPlusToken {
      return "", false
    }
    left, ok := unicornImportStyleStaticString(binary.Left)
    if !ok {
      return "", false
    }
    right, ok := unicornImportStyleStaticString(binary.Right)
    if !ok {
      return "", false
    }
    return left + right, true
  }
  return "", false
}

// reportUnicornImportStyle applies one module's policy to the actual
// styles of a reference. `node:`-prefixed specifiers resolve to the
// bare module's configuration; the diagnostic keeps the original
// spelling. For `require`, an allowed `default` style implies
// `namespace` because CommonJS interop cannot distinguish them.
func reportUnicornImportStyle(
  ctx *Context,
  node *shimast.Node,
  moduleName string,
  actualStyles []string,
  isRequire bool,
  options unicornImportStyleOptions,
) {
  module, exists := options.styles[strings.TrimPrefix(moduleName, "node:")]
  if !exists {
    return
  }
  if len(module.allowed) == 0 {
    if module.banned {
      ctx.Report(node, fmt.Sprintf(
        "All import styles are disabled for module `%s`. Use the `no-restricted-imports` rule to disallow a module.",
        moduleName,
      ))
    }
    return
  }
  effective := module.allowed
  if isRequire &&
    unicornImportStyleContains(effective, unicornImportStyleDefault) &&
    !unicornImportStyleContains(effective, unicornImportStyleNamespace) {
    effective = append(append([]string(nil), module.allowed...), unicornImportStyleNamespace)
  }
  for _, style := range actualStyles {
    if !unicornImportStyleContains(effective, style) {
      ctx.Report(node, fmt.Sprintf(
        "Use %s import for module `%s`.",
        unicornImportStyleDisjunction(module.allowed),
        moduleName,
      ))
      return
    }
  }
}

func unicornImportStyleContains(styles []string, style string) bool {
  for _, candidate := range styles {
    if candidate == style {
      return true
    }
  }
  return false
}

// unicornImportStyleDisjunction renders the allowed styles the way
// upstream's `Intl.ListFormat("en-US", {type: "disjunction"})` does:
// "a", "a or b", "a, b, or c".
func unicornImportStyleDisjunction(items []string) string {
  switch len(items) {
  case 0:
    return ""
  case 1:
    return items[0]
  case 2:
    return items[0] + " or " + items[1]
  default:
    return strings.Join(items[:len(items)-1], ", ") + ", or " + items[len(items)-1]
  }
}

func init() {
  Register(unicornImportStyle{})
}
