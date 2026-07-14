// unicorn/no-unused-properties: report properties of object literals and
// inline type literals that no reference ever reads.
//
// Port of the current upstream analysis: for every single-definition
// variable that binds an object literal (or carries an inline `{...}` type
// annotation, including annotated parameters), walk the variable's
// references and keep only the ones that can reach each property — a member
// access with the same key, a dynamic/computed access, a member call or
// assignment, a destructuring that names the key or uses rest, or any
// escape (alias, argument, return, export, spread). A property whose
// reference list filters down to nothing is dead data and gets reported;
// references that survive drive the same analysis one level deeper into
// nested object/type literals.
//
// Escape analysis stays conservative exactly where upstream is: one
// unpredictable use (passed, returned, aliased, exported, computed access,
// mutated) marks every property as used. Variables in a script file's
// global scope are skipped, mirroring upstream's global-scope exclusion.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/rules/no-unused-properties.js
package linthost

import (
  "math/big"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

type unicornNoUnusedProperties struct{}

func (unicornNoUnusedProperties) Name() string { return "unicorn/no-unused-properties" }
func (unicornNoUnusedProperties) NeedsTypeChecker() bool {
  return true
}
func (unicornNoUnusedProperties) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindSourceFile}
}

// unusedPropertiesReference is one use of the analyzed variable. At the top
// level `node` is the referencing Identifier; recursion into nested
// containers replaces it with the syntax that consumed the previous key
// (member expression, matched destructuring, exported declaration) so the
// next level can inspect that node's parent. `init` marks the write at the
// variable's own declarator.
type unusedPropertiesReference struct {
  node *shimast.Node
  init bool
}

// unusedPropertiesCandidate is one analyzable variable: a binding identifier
// plus the property container its declaration supplies.
type unusedPropertiesCandidate struct {
  nameNode    *shimast.Node
  container   *shimast.Node
  declaration *shimast.Node
  references  []unusedPropertiesReference
}

// unusedPropertiesKey is the comparable identity of a property key or member
// access. `class` separates runtime value kinds (string names and string
// literals share one class; numbers, bigints, booleans and null each keep
// their own) so `foo[0]` matches `{0: 1}` but not `{"0": 1}`, mirroring the
// strict-equality comparison upstream performs on key values.
type unusedPropertiesKey struct {
  class string
  text  string
  ok    bool
}

func (unicornNoUnusedProperties) Check(ctx *Context, node *shimast.Node) {
  if ctx == nil || ctx.Checker == nil || ctx.File == nil ||
    node == nil || node.Kind != shimast.KindSourceFile {
    return
  }
  candidates := unusedPropertiesCollectCandidates(ctx, node)
  if len(candidates) == 0 {
    return
  }
  unusedPropertiesCollectReferences(ctx, node, candidates)
  pureWrites := unusedPropertiesCollectPureWriteTargets(node)
  for _, candidate := range candidates {
    if !unusedPropertiesHasReadReference(candidate, pureWrites) {
      continue
    }
    unusedPropertiesReportContainer(ctx, candidate.container, candidate.references)
  }
}

// unusedPropertiesCollectCandidates walks the file for variables the rule can
// analyze: variable declarations whose initializer (through TS assertion
// wrappers) is an object literal or whose annotated type is an inline type
// literal, and identifier parameters annotated with an inline type literal.
// Mirroring upstream's scope walk, script-file globals are excluded; only a
// module's top level is analyzable.
func unusedPropertiesCollectCandidates(
  ctx *Context,
  root *shimast.Node,
) []*unusedPropertiesCandidate {
  var candidates []*unusedPropertiesCandidate
  walkDescendants(root, func(child *shimast.Node) {
    switch child.Kind {
    case shimast.KindVariableDeclaration:
      declaration := child.AsVariableDeclaration()
      if declaration == nil || declaration.Initializer == nil {
        return
      }
      container := unusedPropertiesDeclarationContainer(declaration)
      if container == nil || unusedPropertiesDeclaredInGlobalScope(ctx.File, child) {
        return
      }
      for _, nameNode := range bindingIdentifierNodes(declaration.Name()) {
        candidates = append(candidates, &unusedPropertiesCandidate{
          nameNode:    nameNode,
          container:   container,
          declaration: child,
        })
      }
    case shimast.KindParameter:
      parameter := child.AsParameterDeclaration()
      if parameter == nil || parameter.Type == nil ||
        parameter.Type.Kind != shimast.KindTypeLiteral {
        return
      }
      nameNode := parameter.Name()
      if nameNode == nil || nameNode.Kind != shimast.KindIdentifier {
        return
      }
      candidates = append(candidates, &unusedPropertiesCandidate{
        nameNode:    nameNode,
        container:   parameter.Type,
        declaration: child,
      })
    }
  })
  return candidates
}

// unusedPropertiesDeclarationContainer resolves the property container a
// variable declaration supplies: the object literal it is initialized with
// (TS assertion wrappers are transparent), else the inline type literal it
// is annotated with. Upstream only consults the annotation when an
// initializer exists (`declare const x: {...}` stays out of scope); the
// caller has already required one.
func unusedPropertiesDeclarationContainer(
  declaration *shimast.VariableDeclaration,
) *shimast.Node {
  initializer := unwrapReferenceExpression(declaration.Initializer)
  if initializer != nil && initializer.Kind == shimast.KindObjectLiteralExpression {
    return initializer
  }
  if declaration.Type != nil && declaration.Type.Kind == shimast.KindTypeLiteral {
    return declaration.Type
  }
  return nil
}

// unusedPropertiesDeclaredInGlobalScope reports whether a variable
// declaration lands in the global scope, which only exists at the top level
// of a script file (no import/export). `var` hoists past blocks, so it is
// global unless a function-like body, class static block, or namespace body
// intervenes; `let`/`const`/`using` are global only as a direct top-level
// statement.
func unusedPropertiesDeclaredInGlobalScope(
  file *shimast.SourceFile,
  declaration *shimast.Node,
) bool {
  if file == nil || file.ExternalModuleIndicator != nil {
    return false
  }
  if shimast.GetCombinedNodeFlags(declaration)&shimast.NodeFlagsBlockScoped != 0 {
    list := declaration.Parent
    if list == nil || list.Parent == nil ||
      list.Parent.Kind != shimast.KindVariableStatement {
      return false
    }
    statement := list.Parent
    return statement.Parent != nil && statement.Parent.Kind == shimast.KindSourceFile
  }
  for ancestor := declaration.Parent; ancestor != nil; ancestor = ancestor.Parent {
    if isFunctionLikeKind(ancestor) {
      return false
    }
    switch ancestor.Kind {
    case shimast.KindClassStaticBlockDeclaration,
      shimast.KindModuleBlock,
      shimast.KindModuleDeclaration:
      return false
    case shimast.KindSourceFile:
      return true
    }
  }
  return false
}

// unusedPropertiesCollectReferences fills each candidate's reference list by
// resolving every same-named identifier in the file to its checker symbol.
// The candidate's own binding identifier becomes the `init` reference when
// the declarator has an initializer; parameters bind without one. Candidates
// whose symbol cannot be resolved to exactly one declaration lose their
// container, which excludes them from analysis.
func unusedPropertiesCollectReferences(
  ctx *Context,
  root *shimast.Node,
  candidates []*unusedPropertiesCandidate,
) {
  bySymbol := make(map[*shimast.Symbol]*unusedPropertiesCandidate, len(candidates))
  names := make(map[string]struct{}, len(candidates))
  for _, candidate := range candidates {
    symbol := unusedPropertiesDeclaredSymbol(ctx, candidate)
    if symbol == nil || len(symbol.Declarations) != 1 || bySymbol[symbol] != nil {
      candidate.container = nil
      continue
    }
    bySymbol[symbol] = candidate
    names[identifierText(candidate.nameNode)] = struct{}{}
  }
  if len(bySymbol) == 0 {
    return
  }
  walkDescendants(root, func(child *shimast.Node) {
    if child.Kind != shimast.KindIdentifier {
      return
    }
    if _, possible := names[identifierText(child)]; !possible {
      return
    }
    candidate, ok := bySymbol[unusedPropertiesSymbolAtIdentifier(ctx, child)]
    if !ok {
      return
    }
    if child == candidate.nameNode {
      if candidate.declaration.Kind == shimast.KindVariableDeclaration {
        candidate.references = append(candidate.references, unusedPropertiesReference{
          node: child,
          init: true,
        })
      }
      return
    }
    candidate.references = append(candidate.references, unusedPropertiesReference{node: child})
  })
}

// unusedPropertiesDeclaredSymbol resolves a candidate's binding identifier to
// its canonical symbol. A TypeScript parameter property carries two symbols
// at one declaration name — the class member and the constructor-local
// parameter; body references bind to the latter, so the constructor's locals
// table is the canonical lookup (mirrors noParamReassignParameterSymbol).
func unusedPropertiesDeclaredSymbol(
  ctx *Context,
  candidate *unusedPropertiesCandidate,
) *shimast.Symbol {
  declaration := candidate.declaration
  if declaration.Kind == shimast.KindParameter && declaration.Parent != nil &&
    declaration.Parent.Kind == shimast.KindConstructor && isParameterProperty(declaration) {
    symbol := declaration.Parent.Locals()[identifierText(candidate.nameNode)]
    if symbol == nil {
      return nil
    }
    return ctx.Checker.GetMergedSymbol(symbol)
  }
  return unusedPropertiesSymbolAtIdentifier(ctx, candidate.nameNode)
}

// unusedPropertiesSymbolAtIdentifier resolves an identifier in value position
// to its canonical binding symbol. Shorthand property values and export
// specifiers need their dedicated checker queries: `({foo} = x)` resolves the
// written binding and `export { foo }` resolves the aliased local rather than
// the specifier's own alias symbol, matching how the checker's own
// reference-finding treats those positions.
func unusedPropertiesSymbolAtIdentifier(
  ctx *Context,
  identifier *shimast.Node,
) *shimast.Symbol {
  if identifier == nil || identifier.Kind != shimast.KindIdentifier {
    return nil
  }
  symbol := valueSymbolAtIdentifier(ctx, identifier)
  if parent := identifier.Parent; parent != nil && parent.Kind == shimast.KindExportSpecifier {
    if specifier := parent.AsExportSpecifier(); specifier != nil &&
      unusedPropertiesIsExportSpecifierAlias(identifier, specifier) {
      if local := ctx.Checker.GetExportSpecifierLocalTargetSymbol(parent); local != nil {
        symbol = local
      }
    }
  }
  if symbol == nil {
    return nil
  }
  if symbol.Flags&shimast.SymbolFlagsExportValue != 0 && symbol.ExportSymbol != nil {
    symbol = symbol.ExportSymbol
  }
  return ctx.Checker.GetMergedSymbol(symbol)
}

// unusedPropertiesIsExportSpecifierAlias reports whether the identifier is
// the side of an export specifier that references a local binding: the
// property name of `export { foo as bar }`, or the single name of a
// non-re-export `export { foo }`.
func unusedPropertiesIsExportSpecifierAlias(
  identifier *shimast.Node,
  specifier *shimast.ExportSpecifier,
) bool {
  if specifier.PropertyName != nil {
    return specifier.PropertyName == identifier
  }
  declaration := specifier.AsNode().Parent
  if declaration != nil {
    declaration = declaration.Parent
  }
  return declaration == nil || declaration.ModuleSpecifier() == nil
}

// unusedPropertiesCollectPureWriteTargets gathers every identifier written by
// a plain `=` assignment (including destructuring targets) or a for-in/of
// head. Those references never read the variable, so a variable whose uses
// are all pure writes is left to no-unused-vars, exactly like upstream's
// read-reference check. Compound assignments and updates read before writing
// and are intentionally absent.
func unusedPropertiesCollectPureWriteTargets(
  root *shimast.Node,
) map[*shimast.Node]struct{} {
  targets := make(map[*shimast.Node]struct{})
  walkDescendants(root, func(child *shimast.Node) {
    switch child.Kind {
    case shimast.KindBinaryExpression:
      expression := child.AsBinaryExpression()
      if expression == nil || expression.OperatorToken == nil ||
        expression.OperatorToken.Kind != shimast.KindEqualsToken ||
        isDestructuringDefaultAssignment(child) {
        return
      }
      for _, target := range assignmentTargetIdentifiers(expression.Left) {
        targets[target] = struct{}{}
      }
    case shimast.KindForInStatement, shimast.KindForOfStatement:
      statement := child.AsForInOrOfStatement()
      if statement == nil || statement.Initializer == nil ||
        statement.Initializer.Kind == shimast.KindVariableDeclarationList {
        return
      }
      for _, target := range assignmentTargetIdentifiers(statement.Initializer) {
        targets[target] = struct{}{}
      }
    }
  })
  return targets
}

// unusedPropertiesHasReadReference reports whether the candidate is read at
// least once. A candidate stripped of its container (unresolvable symbol) or
// with write-only references is skipped entirely.
func unusedPropertiesHasReadReference(
  candidate *unusedPropertiesCandidate,
  pureWrites map[*shimast.Node]struct{},
) bool {
  if candidate.container == nil {
    return false
  }
  for _, reference := range candidate.references {
    if reference.init {
      continue
    }
    if _, writeOnly := pureWrites[reference.node]; writeOnly {
      continue
    }
    return true
  }
  return false
}

// unusedPropertiesReportContainer checks every named property of an object or
// type literal against the reference list, reporting the ones nothing can
// read and recursing into nested containers with the references that reached
// their property.
func unusedPropertiesReportContainer(
  ctx *Context,
  container *shimast.Node,
  references []unusedPropertiesReference,
) {
  for _, property := range unusedPropertiesContainerProperties(container) {
    keyNode := property.Name()
    if keyNode == nil {
      continue
    }
    key := unusedPropertiesKeyOf(keyNode)
    if key.ok && key.class == "string" && key.text == "__proto__" {
      continue
    }
    next := unusedPropertiesFilterReferences(references, key)
    if len(next) == 0 {
      ctx.Report(
        property,
        "Property `"+unusedPropertiesDisplayName(ctx.File, keyNode, key)+"` is defined but never used.",
      )
      continue
    }
    if nested := unusedPropertiesPropertyContainer(property); nested != nil {
      unusedPropertiesReportContainer(ctx, nested, next)
    }
  }
}

// unusedPropertiesContainerProperties returns the analyzable members of a
// property container: every keyed property of an object literal (spreads
// have no key and are skipped by the caller's nil check), or the property
// signatures of a type literal. Index, call, construct, method, and accessor
// signatures carry no analyzable data slot, matching upstream's
// TSPropertySignature filter.
func unusedPropertiesContainerProperties(container *shimast.Node) []*shimast.Node {
  switch container.Kind {
  case shimast.KindObjectLiteralExpression:
    literal := container.AsObjectLiteralExpression()
    if literal == nil || literal.Properties == nil {
      return nil
    }
    properties := make([]*shimast.Node, 0, len(literal.Properties.Nodes))
    for _, property := range literal.Properties.Nodes {
      if property == nil || property.Kind == shimast.KindSpreadAssignment {
        continue
      }
      properties = append(properties, property)
    }
    return properties
  case shimast.KindTypeLiteral:
    literal := container.AsTypeLiteralNode()
    if literal == nil || literal.Members == nil {
      return nil
    }
    var members []*shimast.Node
    for _, member := range literal.Members.Nodes {
      if member != nil && member.Kind == shimast.KindPropertySignature {
        members = append(members, member)
      }
    }
    return members
  }
  return nil
}

// unusedPropertiesPropertyContainer resolves the nested container a surviving
// property recurses into: an object-literal initializer (through TS
// assertion wrappers) or a property signature's inline type literal.
func unusedPropertiesPropertyContainer(property *shimast.Node) *shimast.Node {
  switch property.Kind {
  case shimast.KindPropertyAssignment:
    assignment := property.AsPropertyAssignment()
    if assignment == nil {
      return nil
    }
    value := unwrapReferenceExpression(assignment.Initializer)
    if value != nil && value.Kind == shimast.KindObjectLiteralExpression {
      return value
    }
  case shimast.KindPropertySignature:
    signature := property.AsPropertySignatureDeclaration()
    if signature != nil && signature.Type != nil &&
      signature.Type.Kind == shimast.KindTypeLiteral {
      return signature.Type
    }
  }
  return nil
}

// unusedPropertiesFilterReferences maps the reference list for one property
// key, mirroring upstream's per-key reference walk:
//
//   - the declarator's own init write only survives for `export const`,
//     where it stands in for the unseen importers;
//   - a member access survives when it is assigned, called, dynamically
//     computed, or names this key — and is dropped when it names a
//     different known key;
//   - destructuring (declaration or assignment form) survives when the
//     pattern names this key or uses a rest element;
//   - anything else — call argument, return, alias, spread, export — is an
//     escape and survives untouched.
func unusedPropertiesFilterReferences(
  references []unusedPropertiesReference,
  key unusedPropertiesKey,
) []unusedPropertiesReference {
  var next []unusedPropertiesReference
  for _, reference := range references {
    parent := unusedPropertiesReferenceParent(reference.node)
    if parent == nil {
      next = append(next, reference)
      continue
    }
    if reference.init {
      if parent.Kind == shimast.KindVariableDeclaration &&
        unusedPropertiesDeclarationIsExported(parent) {
        next = append(next, unusedPropertiesReference{node: parent})
      }
      continue
    }
    switch parent.Kind {
    case shimast.KindPropertyAccessExpression, shimast.KindElementAccessExpression:
      if unusedPropertiesMemberAccessKeeps(parent, key) {
        next = append(next, unusedPropertiesReference{node: parent})
      }
      continue
    case shimast.KindVariableDeclaration:
      declaration := parent.AsVariableDeclaration()
      if declaration != nil && declaration.Name() != nil &&
        declaration.Name().Kind == shimast.KindObjectBindingPattern {
        if unusedPropertiesBindingPatternMatches(declaration.Name(), key) {
          next = append(next, unusedPropertiesReference{node: parent})
        }
        continue
      }
    case shimast.KindBinaryExpression:
      expression := parent.AsBinaryExpression()
      if expression != nil && expression.OperatorToken != nil &&
        isAssignmentOperator(expression.OperatorToken.Kind) &&
        expression.Left != nil &&
        expression.Left.Kind == shimast.KindObjectLiteralExpression &&
        !isDestructuringDefaultAssignment(parent) {
        if unusedPropertiesAssignmentPatternMatches(expression.Left, key) {
          next = append(next, unusedPropertiesReference{node: parent})
        }
        continue
      }
    }
    next = append(next, reference)
  }
  return next
}

// unusedPropertiesReferenceParent returns the node that consumes a reference,
// looking through parentheses and TypeScript assertion wrappers (`as`,
// `satisfies`, `!`, angle-bracket assertions) whenever the reference is the
// wrapped expression, so `(foo as Foo).a` behaves like `foo.a`.
func unusedPropertiesReferenceParent(node *shimast.Node) *shimast.Node {
  for node != nil && node.Parent != nil {
    parent := node.Parent
    switch parent.Kind {
    case shimast.KindParenthesizedExpression,
      shimast.KindAsExpression,
      shimast.KindSatisfiesExpression,
      shimast.KindNonNullExpression,
      shimast.KindTypeAssertionExpression:
      if parent.Expression() == node {
        node = parent
        continue
      }
    }
    return parent
  }
  return nil
}

// unusedPropertiesDeclarationIsExported reports whether a variable
// declaration belongs to an `export const/let/var` statement.
func unusedPropertiesDeclarationIsExported(declaration *shimast.Node) bool {
  list := declaration.Parent
  if list == nil || list.Parent == nil ||
    list.Parent.Kind != shimast.KindVariableStatement {
    return false
  }
  return hasModifier(list.Parent, shimast.KindExportKeyword)
}

// unusedPropertiesMemberAccessKeeps decides whether a member access on the
// analyzed value can reach the property key. Assignments (either side, like
// upstream), calls through the member, and dynamic indexes are conservative
// keeps; a static access survives only when its key equals the property's.
//
// The consumer of the member is found through parentheses only — `(foo.a)()`
// is a member call, exactly as in upstream's paren-free ESTree — while
// TypeScript wrappers stay opaque: upstream inspects the member's direct
// parent, so `(foo.a as any)()` is not treated as a call.
func unusedPropertiesMemberAccessKeeps(member *shimast.Node, key unusedPropertiesKey) bool {
  wrapped := member
  for wrapped.Parent != nil && wrapped.Parent.Kind == shimast.KindParenthesizedExpression &&
    wrapped.Parent.Expression() == wrapped {
    wrapped = wrapped.Parent
  }
  if grand := wrapped.Parent; grand != nil {
    if grand.Kind == shimast.KindBinaryExpression {
      expression := grand.AsBinaryExpression()
      if expression != nil && expression.OperatorToken != nil &&
        isAssignmentOperator(expression.OperatorToken.Kind) &&
        !isDestructuringDefaultAssignment(grand) {
        return true
      }
    }
    if grand.Kind == shimast.KindCallExpression {
      call := grand.AsCallExpression()
      if call != nil && call.Expression == wrapped {
        return true
      }
    }
  }
  if member.Kind == shimast.KindElementAccessExpression {
    access := member.AsElementAccessExpression()
    if access == nil {
      return false
    }
    index := stripParens(access.ArgumentExpression)
    if !unusedPropertiesPredictableIndex(index) {
      return true
    }
    return unusedPropertiesKeysEqual(unusedPropertiesKeyOf(index), key)
  }
  access := member.AsPropertyAccessExpression()
  if access == nil {
    return false
  }
  return unusedPropertiesKeysEqual(unusedPropertiesKeyOf(access.Name()), key)
}

// unusedPropertiesPredictableIndex reports whether an element-access index is
// a literal whose value is knowable without evaluation. Everything else —
// identifiers, templates, expressions — is a dynamic access that could reach
// any property.
func unusedPropertiesPredictableIndex(index *shimast.Node) bool {
  if index == nil {
    return false
  }
  switch index.Kind {
  case shimast.KindStringLiteral,
    shimast.KindNumericLiteral,
    shimast.KindBigIntLiteral,
    shimast.KindTrueKeyword,
    shimast.KindFalseKeyword,
    shimast.KindNullKeyword,
    shimast.KindRegularExpressionLiteral:
    return true
  }
  return false
}

// unusedPropertiesBindingPatternMatches reports whether an object binding
// pattern (`const {a, ...rest} = value`) can extract the property key.
func unusedPropertiesBindingPatternMatches(pattern *shimast.Node, key unusedPropertiesKey) bool {
  binding := pattern.AsBindingPattern()
  if binding == nil || binding.Elements == nil {
    return false
  }
  for _, elementNode := range binding.Elements.Nodes {
    element := elementNode.AsBindingElement()
    if element == nil {
      continue
    }
    if element.DotDotDotToken != nil {
      return true
    }
    keyNode := element.PropertyName
    if keyNode == nil {
      keyNode = element.Name()
    }
    if unusedPropertiesKeysEqual(unusedPropertiesKeyOf(keyNode), key) {
      return true
    }
  }
  return false
}

// unusedPropertiesAssignmentPatternMatches reports whether the object pattern
// of a destructuring assignment (`({a, ...rest} = value)`) can extract the
// property key. The pattern parses as an object literal in TS-go's AST.
func unusedPropertiesAssignmentPatternMatches(pattern *shimast.Node, key unusedPropertiesKey) bool {
  literal := pattern.AsObjectLiteralExpression()
  if literal == nil || literal.Properties == nil {
    return false
  }
  for _, property := range literal.Properties.Nodes {
    if property == nil {
      continue
    }
    if property.Kind == shimast.KindSpreadAssignment {
      return true
    }
    switch property.Kind {
    case shimast.KindPropertyAssignment, shimast.KindShorthandPropertyAssignment:
      if unusedPropertiesKeysEqual(unusedPropertiesKeyOf(property.Name()), key) {
        return true
      }
    }
  }
  return false
}

// unusedPropertiesKeyOf normalizes a property name or index expression to a
// comparable key. Identifiers compare as strings (so a computed `[a]` key
// matches `.a` access, as upstream's name-based comparison does), string
// literals by value, numeric literals by their canonical numeric text (the
// parser already normalizes `0xFF`/`1e2`/`1_000`), bigint literals by their
// canonical decimal value, and boolean/null literals within their own
// classes. Parentheses inside a computed name are transparent because
// ESTree has no parenthesized-expression node. Anything else has no
// predictable name.
func unusedPropertiesKeyOf(node *shimast.Node) unusedPropertiesKey {
  if node == nil {
    return unusedPropertiesKey{}
  }
  switch node.Kind {
  case shimast.KindIdentifier:
    return unusedPropertiesKey{class: "string", text: identifierText(node), ok: true}
  case shimast.KindStringLiteral:
    return unusedPropertiesKey{class: "string", text: stringLiteralText(node), ok: true}
  case shimast.KindNumericLiteral:
    return unusedPropertiesKey{class: "number", text: numericLiteralText(node), ok: true}
  case shimast.KindBigIntLiteral:
    return unusedPropertiesKey{
      class: "bigint",
      text:  unusedPropertiesBigIntText(numericLiteralText(node)),
      ok:    true,
    }
  case shimast.KindTrueKeyword:
    return unusedPropertiesKey{class: "boolean", text: "true", ok: true}
  case shimast.KindFalseKeyword:
    return unusedPropertiesKey{class: "boolean", text: "false", ok: true}
  case shimast.KindNullKeyword:
    return unusedPropertiesKey{class: "null", text: "null", ok: true}
  case shimast.KindComputedPropertyName:
    computed := node.AsComputedPropertyName()
    if computed == nil || computed.Expression == nil {
      return unusedPropertiesKey{}
    }
    return unusedPropertiesKeyOf(stripParens(computed.Expression))
  }
  return unusedPropertiesKey{}
}

// unusedPropertiesBigIntText converts a bigint literal's source text (which
// the parser keeps verbatim, unlike normalized number literals) into its
// canonical decimal digits, so `0x10n` and `16n` compare equal the way
// upstream's BigInt value comparison does. Legacy octal (`0123n`) is a
// syntax error in JavaScript, so base auto-detection over the `0x`/`0o`/`0b`
// prefixes is unambiguous; unparsable text falls back to itself.
func unusedPropertiesBigIntText(text string) string {
  digits := text
  if len(digits) > 0 && digits[len(digits)-1] == 'n' {
    digits = digits[:len(digits)-1]
  }
  value, ok := new(big.Int).SetString(digits, 0)
  if !ok {
    return digits
  }
  return value.String()
}

func unusedPropertiesKeysEqual(a, b unusedPropertiesKey) bool {
  return a.ok && b.ok && a.class == b.class && a.text == b.text
}

// unusedPropertiesDisplayName renders the property key for the diagnostic
// message: resolved key text when the key is predictable, otherwise the
// source text of the (computed) key expression.
func unusedPropertiesDisplayName(
  file *shimast.SourceFile,
  keyNode *shimast.Node,
  key unusedPropertiesKey,
) string {
  if key.ok {
    return key.text
  }
  if keyNode.Kind == shimast.KindComputedPropertyName {
    if computed := keyNode.AsComputedPropertyName(); computed != nil && computed.Expression != nil {
      return nodeText(file, computed.Expression)
    }
  }
  return nodeText(file, keyNode)
}

func init() {
  Register(unicornNoUnusedProperties{})
}
