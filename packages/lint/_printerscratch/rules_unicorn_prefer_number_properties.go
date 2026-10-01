// unicorn/prefer-number-properties: the global functions `isNaN`,
// `isFinite`, `parseFloat`, `parseInt`, and the global constants `NaN`,
// `Infinity` were aliased onto the `Number` namespace in ES2015. The
// `Number.*` forms coerce more predictably (`Number.isNaN("abc")` is
// `false`, while the global `isNaN("abc")` is `true`) and are more
// discoverable. The rule pushes authors to the namespaced spellings.
//
// Faithful port of eslint-plugin-unicorn `rules/prefer-number-properties.js`.
// The upstream rule tracks *references to the global binding* through scope
// analysis; this port reproduces that with the TypeScript-Go checker so a
// locally shadowed `parseInt` / `isNaN` (a different value) is never flagged,
// while genuine value-position reads — including an object initializer
// (`{normalize: parseFloat}`) and a shorthand (`{parseInt}`) — are. Options
// `checkInfinity` and `checkNaN` both default to `false`, so `Infinity` and
// `NaN` are only checked when the caller opts in. `parseInt(x)` and
// `parseInt(x, 10)` already yield what `Number.parseInt` would and are left
// alone; assignment / update / destructuring / `delete` targets are not reads
// and are excluded. Diagnostics interpolate the real spellings
// (`Number.<property>` over `<description>`) and carry an autofix, or a
// suggestion where the rewrite could change runtime behavior.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-number-properties.md
package linthost

import (
  "bytes"
  "encoding/json"
  "fmt"
  "strings"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimchecker "github.com/microsoft/typescript-go/shim/checker"
)

// unicornPreferNumberPropertiesGlobals maps each shadowable global name to
// whether replacing it with `Number.<name>` is unconditionally safe (upstream's
// `globalObjects`). `parseInt`, `parseFloat`, `NaN`, and `Infinity` are pure
// aliases, so the fix applies automatically; `isNaN` and `isFinite` differ from
// `Number.isNaN` / `Number.isFinite` on non-number arguments, so they autofix
// only when the sole argument is provably a number and are otherwise offered as
// an opt-in suggestion.
var unicornPreferNumberPropertiesGlobals = map[string]bool{
  "parseInt":   true,
  "parseFloat": true,
  "NaN":        true,
  "Infinity":   true,
  "isNaN":      false,
  "isFinite":   false,
}

type unicornPreferNumberProperties struct{ optionsRule }

type unicornPreferNumberPropertiesOptions struct {
  checkInfinity bool
  checkNaN      bool
}

func (unicornPreferNumberProperties) Name() string {
  return "unicorn/prefer-number-properties"
}
func (unicornPreferNumberProperties) NeedsTypeChecker() bool { return true }
func (unicornPreferNumberProperties) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindIdentifier}
}

func (unicornPreferNumberProperties) ValidateOptions(raw json.RawMessage) error {
  _, err := decodeUnicornPreferNumberPropertiesOptions(raw)
  return err
}

func (unicornPreferNumberProperties) Check(ctx *Context, node *shimast.Node) {
  name := identifierText(node)
  isSafeGlobal, tracked := unicornPreferNumberPropertiesGlobals[name]
  if !tracked {
    return
  }
  options, err := decodeUnicornPreferNumberPropertiesOptions(ctx.Options)
  if err != nil {
    // Malformed options are already surfaced as a configuration error at
    // engine construction; stay side-effect-free here.
    return
  }
  // `Infinity` and `NaN` leave the tracked set unless the caller opts in;
  // both options default to false.
  if name == "Infinity" && !options.checkInfinity {
    return
  }
  if name == "NaN" && !options.checkNaN {
    return
  }
  // Only value-expression reads are candidates. Declaration names, property
  // keys, member-access right sides, type positions, and import/export
  // specifiers are name slots, not references to the global; value positions
  // such as `{key: parseFloat}` and the shorthand `{parseInt}` are kept.
  if !isUnicornValuePositionIdentifier(node) {
    return
  }
  // Assignment / update / destructuring / delete targets are writes, not reads.
  if unicornPreferNumberPropertiesIsLeftHandSide(node) {
    return
  }
  if name == "Infinity" && unicornPreferNumberPropertiesIsDeletedNegativeInfinity(node) {
    return
  }
  // `parseInt(x)` (no radix) and `parseInt(x, 10)` (explicit base 10) already
  // produce what `Number.parseInt` would, so upstream skips them.
  if name == "parseInt" && unicornPreferNumberPropertiesIsBase10OrNoRadixCall(ctx, node) {
    return
  }
  // Bind the identifier: a locally shadowed name is a different value.
  if !unicornPreferNumberPropertiesResolvesGlobal(ctx, node, name) {
    return
  }
  unicornPreferNumberPropertiesReport(ctx, node, name, isSafeGlobal)
}

// unicornPreferNumberPropertiesReport emits the diagnostic with the substituted
// message plus an autofix or a suggestion, mirroring upstream's
// getPropertyProblem. `Infinity` maps to `POSITIVE_INFINITY`, or, when negated,
// to a `NEGATIVE_INFINITY` fix anchored on the whole `-Infinity` unary.
func unicornPreferNumberPropertiesReport(ctx *Context, node *shimast.Node, name string, isSafeGlobal bool) {
  property := name
  description := name

  if name == "Infinity" {
    if unicornPreferNumberPropertiesIsNegative(node) {
      unary := node.Parent
      message := unicornPreferNumberPropertiesMessage("NEGATIVE_INFINITY", "-Infinity")
      if edits, ok := unicornPreferNumberPropertiesNegativeInfinityFix(ctx, unary); ok {
        ctx.ReportFix(unary, message, edits...)
        return
      }
      ctx.Report(unary, message)
      return
    }
    property = "POSITIVE_INFINITY"
  }

  message := unicornPreferNumberPropertiesMessage(property, description)
  edits, ok := unicornPreferNumberPropertiesReplaceFix(ctx, node, property)
  if !ok {
    ctx.Report(node, message)
    return
  }
  if isSafeGlobal || unicornPreferNumberPropertiesIsCallWithNumberArgument(ctx, node) {
    ctx.ReportFix(node, message, edits...)
    return
  }
  title := fmt.Sprintf("Replace `%s` with `Number.%s`.", description, property)
  ctx.ReportSuggestion(node, message, title, edits...)
}

func unicornPreferNumberPropertiesMessage(property, description string) string {
  return fmt.Sprintf("Prefer `Number.%s` over `%s`.", property, description)
}

// unicornPreferNumberPropertiesReplaceFix builds the edit that rewrites the
// identifier to `Number.<property>`. A shorthand property value must expand to
// `name: Number.<property>` because `{Number.parseInt}` is not valid syntax
// (upstream's replaceReferenceIdentifier).
func unicornPreferNumberPropertiesReplaceFix(ctx *Context, node *shimast.Node, property string) ([]TextEdit, bool) {
  pos, end := tokenRange(ctx.File, node)
  if pos < 0 {
    return nil, false
  }
  replacement := "Number." + property
  if parent := node.Parent; parent != nil && parent.Kind == shimast.KindShorthandPropertyAssignment {
    if shorthand := parent.AsShorthandPropertyAssignment(); shorthand != nil && shorthand.Name() == node {
      replacement = identifierText(node) + ": " + replacement
    }
  }
  return []TextEdit{{Pos: pos, End: end, Text: replacement}}, true
}

// unicornPreferNumberPropertiesNegativeInfinityFix rewrites a `-Infinity` unary
// to `Number.NEGATIVE_INFINITY`, inserting a leading space when the preceding
// byte is an identifier part so a keyword operand (`return-Infinity`) does not
// merge with the replacement (upstream's fixSpaceAroundKeyword).
func unicornPreferNumberPropertiesNegativeInfinityFix(ctx *Context, unary *shimast.Node) ([]TextEdit, bool) {
  pos, end := tokenRange(ctx.File, unary)
  if pos < 0 {
    return nil, false
  }
  replacement := "Number.NEGATIVE_INFINITY"
  if src := ctx.File.Text(); pos > 0 && pos <= len(src) && isIdentifierPart(src[pos-1]) {
    replacement = " " + replacement
  }
  return []TextEdit{{Pos: pos, End: end, Text: replacement}}, true
}

// unicornPreferNumberPropertiesResolvesGlobal reports whether the identifier is
// a reference to the program's global binding of `name`, not a local shadow.
// The same-file value-declaration guard covers script files whose top-level
// binding merges into the checker global table; module bindings already resolve
// to a distinct symbol.
func unicornPreferNumberPropertiesResolvesGlobal(ctx *Context, node *shimast.Node, name string) bool {
  if ctx == nil || ctx.Checker == nil || ctx.File == nil {
    return false
  }
  resolved := valueSymbolAtIdentifier(ctx, node)
  global := ctx.Checker.GetGlobalSymbol(name, shimast.SymbolFlagsValue, nil)
  if resolved == nil || global == nil {
    return false
  }
  resolved = ctx.Checker.GetMergedSymbol(resolved)
  global = ctx.Checker.GetMergedSymbol(global)
  if resolved != global {
    return false
  }
  for _, declaration := range resolved.Declarations {
    if declaration != nil &&
      shimast.GetSourceFileOfNode(declaration) == ctx.File &&
      unicornPreferNumberPropertiesDeclarationIntroducesValue(declaration) {
      return false
    }
  }
  return true
}

// unicornPreferNumberPropertiesDeclarationIntroducesValue distinguishes a
// same-file value binding that shadows the built-in from a type-only
// declaration that legitimately merges with the global's interface.
func unicornPreferNumberPropertiesDeclarationIntroducesValue(declaration *shimast.Node) bool {
  switch declaration.Kind {
  case shimast.KindVariableDeclaration,
    shimast.KindBindingElement,
    shimast.KindParameter,
    shimast.KindFunctionDeclaration,
    shimast.KindClassDeclaration,
    shimast.KindEnumDeclaration,
    shimast.KindModuleDeclaration,
    shimast.KindImportClause,
    shimast.KindImportSpecifier,
    shimast.KindImportEqualsDeclaration,
    shimast.KindNamespaceImport:
    return true
  }
  return false
}

// unicornPreferNumberPropertiesIsLeftHandSide reports whether the identifier is
// written rather than read: an assignment/compound-assignment target, an update
// operand, a `delete` argument, or a destructuring-assignment target (upstream's
// isLeftHandSide).
func unicornPreferNumberPropertiesIsLeftHandSide(node *shimast.Node) bool {
  parent := node.Parent
  if parent == nil {
    return false
  }
  switch parent.Kind {
  case shimast.KindBinaryExpression:
    binary := parent.AsBinaryExpression()
    if binary != nil && binary.Left == node && binary.OperatorToken != nil &&
      isAssignmentOperator(binary.OperatorToken.Kind) {
      return true
    }
  case shimast.KindPrefixUnaryExpression:
    unary := parent.AsPrefixUnaryExpression()
    if unary != nil && unary.Operand == node &&
      (unary.Operator == shimast.KindPlusPlusToken || unary.Operator == shimast.KindMinusMinusToken) {
      return true
    }
  case shimast.KindPostfixUnaryExpression:
    unary := parent.AsPostfixUnaryExpression()
    if unary != nil && unary.Operand == node &&
      (unary.Operator == shimast.KindPlusPlusToken || unary.Operator == shimast.KindMinusMinusToken) {
      return true
    }
  case shimast.KindDeleteExpression:
    del := parent.AsDeleteExpression()
    if del != nil && del.Expression == node {
      return true
    }
  }
  return isDestructuringAssignmentTarget(node)
}

// unicornPreferNumberPropertiesIsNegative reports whether the identifier is the
// operand of a unary minus (`-Infinity`).
func unicornPreferNumberPropertiesIsNegative(node *shimast.Node) bool {
  parent := node.Parent
  if parent == nil || parent.Kind != shimast.KindPrefixUnaryExpression {
    return false
  }
  unary := parent.AsPrefixUnaryExpression()
  return unary != nil && unary.Operator == shimast.KindMinusToken && unary.Operand == node
}

// unicornPreferNumberPropertiesIsDeletedNegativeInfinity reports whether the
// identifier is the `Infinity` of a `delete -Infinity` no-op, which upstream
// leaves untouched.
func unicornPreferNumberPropertiesIsDeletedNegativeInfinity(node *shimast.Node) bool {
  if !unicornPreferNumberPropertiesIsNegative(node) {
    return false
  }
  unary := node.Parent
  if unary == nil || unary.Parent == nil || unary.Parent.Kind != shimast.KindDeleteExpression {
    return false
  }
  del := unary.Parent.AsDeleteExpression()
  return del != nil && del.Expression == unary
}

// unicornPreferNumberPropertiesIsBase10OrNoRadixCall reports whether the
// identifier is a `parseInt` callee with no radix or an explicit base-10 radix.
// The radix is read statically through the checker so a `const R = 10;
// parseInt(x, R)` folds the same way upstream's getStaticValue does.
func unicornPreferNumberPropertiesIsBase10OrNoRadixCall(ctx *Context, node *shimast.Node) bool {
  parent := node.Parent
  if parent == nil || parent.Kind != shimast.KindCallExpression {
    return false
  }
  call := parent.AsCallExpression()
  if call == nil || call.Expression != node || call.Arguments == nil {
    return false
  }
  args := call.Arguments.Nodes
  if len(args) < 2 {
    return true
  }
  radix := args[1]
  if radix == nil || radix.Kind == shimast.KindSpreadElement {
    return false
  }
  if ctx.Checker == nil {
    return false
  }
  t := ctx.Checker.GetTypeAtLocation(radix)
  if t == nil || t.Flags()&shimchecker.TypeFlagsNumberLiteral == 0 {
    return false
  }
  return strings.TrimSpace(ctx.Checker.TypeToString(t)) == "10"
}

// unicornPreferNumberPropertiesIsCallWithNumberArgument reports whether the
// identifier is a callee invoked with exactly one argument whose type is
// provably a number, the condition under which `Number.isNaN` / `Number.isFinite`
// preserve `isNaN` / `isFinite` behavior and the rewrite is safe to autofix.
func unicornPreferNumberPropertiesIsCallWithNumberArgument(ctx *Context, node *shimast.Node) bool {
  parent := node.Parent
  if parent == nil || parent.Kind != shimast.KindCallExpression || ctx.Checker == nil {
    return false
  }
  call := parent.AsCallExpression()
  if call == nil || call.Expression != node || call.Arguments == nil || len(call.Arguments.Nodes) != 1 {
    return false
  }
  argument := call.Arguments.Nodes[0]
  if argument == nil || argument.Kind == shimast.KindSpreadElement {
    return false
  }
  return unicornPreferNumberPropertiesTypeIsNumber(ctx.Checker.GetTypeAtLocation(argument))
}

// unicornPreferNumberPropertiesTypeIsNumber reports whether every constituent of
// `t` is number-like. `any` / `unknown` and any non-number member answer false,
// keeping the autofix conservative — such calls fall back to a suggestion.
func unicornPreferNumberPropertiesTypeIsNumber(t *shimchecker.Type) bool {
  if t == nil {
    return false
  }
  flags := t.Flags()
  if flags&shimchecker.TypeFlagsNumberLike != 0 {
    return true
  }
  if flags&shimchecker.TypeFlagsUnion != 0 {
    parts := t.Types()
    if len(parts) == 0 {
      return false
    }
    for _, part := range parts {
      if !unicornPreferNumberPropertiesTypeIsNumber(part) {
        return false
      }
    }
    return true
  }
  return false
}

// decodeUnicornPreferNumberPropertiesOptions enforces the upstream schema: an
// optional object whose only keys are the boolean `checkInfinity` and `checkNaN`
// (both default false).
func decodeUnicornPreferNumberPropertiesOptions(raw json.RawMessage) (unicornPreferNumberPropertiesOptions, error) {
  options := unicornPreferNumberPropertiesOptions{}
  trimmed := bytes.TrimSpace(raw)
  if len(trimmed) == 0 {
    return options, nil
  }
  if trimmed[0] != '{' {
    return options, fmt.Errorf("options must be an object")
  }
  var fields map[string]json.RawMessage
  if err := json.Unmarshal(trimmed, &fields); err != nil || fields == nil {
    if err == nil {
      err = fmt.Errorf("null object")
    }
    return options, fmt.Errorf("options must be an object: %w", err)
  }
  for name := range fields {
    if name != "checkInfinity" && name != "checkNaN" {
      return options, fmt.Errorf("unknown option %q", name)
    }
  }
  if value, exists := fields["checkInfinity"]; exists {
    if bytes.Equal(bytes.TrimSpace(value), []byte("null")) ||
      json.Unmarshal(value, &options.checkInfinity) != nil {
      return options, fmt.Errorf("option %q must be a boolean", "checkInfinity")
    }
  }
  if value, exists := fields["checkNaN"]; exists {
    if bytes.Equal(bytes.TrimSpace(value), []byte("null")) ||
      json.Unmarshal(value, &options.checkNaN) != nil {
      return options, fmt.Errorf("option %q must be a boolean", "checkNaN")
    }
  }
  return options, nil
}

func init() {
  Register(unicornPreferNumberProperties{})
}
