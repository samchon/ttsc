// Extended @typescript-eslint rules that work off the AST alone (no
// checker, no scope analysis). Rules here complement the core set in
// rules_ts.go; the split is by recommendation tier — this file covers
// rules that appear in typescript-eslint strict, stylistic, or as
// commonly-requested extras. Each rule is registered in init() below.
package linthost

import (
  "strings"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// noConfusingNonNullAssertion: `a! == b` reads ambiguously.
type noConfusingNonNullAssertion struct{}

func (noConfusingNonNullAssertion) Name() string { return "no-confusing-non-null-assertion" }
func (noConfusingNonNullAssertion) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindBinaryExpression}
}
func (noConfusingNonNullAssertion) Check(ctx *Context, node *shimast.Node) {
  expr := node.AsBinaryExpression()
  if expr == nil || expr.OperatorToken == nil || expr.Left == nil {
    return
  }
  switch expr.OperatorToken.Kind {
  case shimast.KindEqualsEqualsToken,
    shimast.KindEqualsEqualsEqualsToken,
    shimast.KindExclamationEqualsToken,
    shimast.KindExclamationEqualsEqualsToken,
    shimast.KindEqualsToken:
  default:
    return
  }
  if expr.Left.Kind == shimast.KindNonNullExpression {
    ctx.Report(node, "Confusing combination of non-null assertion and equality.")
  }
}

// noDuplicateEnumValues: `enum E { A = 1, B = 1 }` — duplicate values
// silently collapse.
type noDuplicateEnumValues struct{}

func (noDuplicateEnumValues) Name() string { return "no-duplicate-enum-values" }
func (noDuplicateEnumValues) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindEnumDeclaration}
}
func (noDuplicateEnumValues) Check(ctx *Context, node *shimast.Node) {
  decl := node.AsEnumDeclaration()
  if decl == nil || decl.Members == nil {
    return
  }
  seen := map[string]bool{}
  for _, member := range decl.Members.Nodes {
    if member == nil {
      continue
    }
    em := member.AsEnumMember()
    if em == nil || em.Initializer == nil {
      continue
    }
    init := em.Initializer
    var key string
    switch init.Kind {
    case shimast.KindNumericLiteral, shimast.KindBigIntLiteral:
      key = "n:" + numericLiteralText(init)
    case shimast.KindStringLiteral, shimast.KindNoSubstitutionTemplateLiteral:
      key = "s:" + stringLiteralText(init)
    default:
      continue
    }
    if seen[key] {
      ctx.Report(member, "Duplicate enum member value.")
      continue
    }
    seen[key] = true
  }
}

// noMixedEnums: forbid enums that mix numeric and string member shapes.
// A single enum with `{ A, B = "two" }` produces broken reverse mappings
// and surprising assignability. typescript-eslint recommended:
// https://typescript-eslint.io/rules/no-mixed-enums/
type noMixedEnums struct{}

func (noMixedEnums) Name() string { return "no-mixed-enums" }
func (noMixedEnums) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindEnumDeclaration}
}
func (noMixedEnums) Check(ctx *Context, node *shimast.Node) {
  decl := node.AsEnumDeclaration()
  if decl == nil || decl.Members == nil {
    return
  }
  // Classify each member as numeric or string. Implicit members
  // (no initializer) count as numeric — that is what tsgo materializes.
  // The rule fires when both categories appear in the same enum body.
  var hasNumeric, hasString bool
  type classification struct {
    member *shimast.Node
    isStr  bool
  }
  members := make([]classification, 0, len(decl.Members.Nodes))
  for _, member := range decl.Members.Nodes {
    if member == nil {
      continue
    }
    em := member.AsEnumMember()
    if em == nil {
      continue
    }
    isStr := false
    if em.Initializer != nil {
      switch em.Initializer.Kind {
      case shimast.KindStringLiteral, shimast.KindNoSubstitutionTemplateLiteral:
        isStr = true
      }
    }
    if isStr {
      hasString = true
    } else {
      hasNumeric = true
    }
    members = append(members, classification{member: member, isStr: isStr})
  }
  if !(hasNumeric && hasString) {
    return
  }
  // Report each member whose category disagrees with the first member's
  // category. ESLint's rule pins to the *second* observed category; we
  // do the same by treating the first member as authoritative.
  firstIsStr := members[0].isStr
  for _, m := range members[1:] {
    if m.isStr != firstIsStr {
      ctx.Report(m.member, "Mixing string and number enum values is not allowed.")
    }
  }
}

// noExtraNonNullAssertion: `a!!` / `a!?.b` collapses two assertions.
type noExtraNonNullAssertion struct{}

func (noExtraNonNullAssertion) Name() string { return "no-extra-non-null-assertion" }
func (noExtraNonNullAssertion) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindNonNullExpression}
}
func (noExtraNonNullAssertion) Check(ctx *Context, node *shimast.Node) {
  parent := node.Parent
  if parent == nil {
    return
  }
  if parent.Kind != shimast.KindNonNullExpression {
    return
  }
  message := "Forbidden extra non-null assertion."
  // The outer NonNullExpression spans `a!!`; the redundant `!` is the
  // last byte before the outer's End. Deleting [parent.End()-1, parent.End())
  // collapses `a!!` to `a!` while preserving any source already after the
  // outer expression.
  pos := parent.End() - 1
  if pos < 0 || pos >= len(ctx.File.Text()) || ctx.File.Text()[pos] != '!' {
    ctx.Report(node, message)
    return
  }
  ctx.ReportFix(
    node,
    message,
    TextEdit{Pos: pos, End: pos + 1, Text: ""},
  )
}

// noNonNullAssertedOptionalChain: `foo?.bar!` — the chain produces
// undefined; asserting non-null on the whole chain defeats the chain.
type noNonNullAssertedOptionalChain struct{}

func (noNonNullAssertedOptionalChain) Name() string { return "no-non-null-asserted-optional-chain" }
func (noNonNullAssertedOptionalChain) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindNonNullExpression}
}
func (noNonNullAssertedOptionalChain) Check(ctx *Context, node *shimast.Node) {
  inner := node.AsNonNullExpression()
  if inner == nil || inner.Expression == nil {
    return
  }
  if containsOptionalChain(inner.Expression) {
    ctx.Report(node, "Optional chain expressions can return undefined; non-null assertion bypasses that check.")
  }
}

// containsOptionalChain reports whether node or any of its left-hand
// sub-expressions uses the optional-chaining operator (?.). Only descends
// into PropertyAccessExpression, ElementAccessExpression, and
// CallExpression chains — stops at any other node kind.
func containsOptionalChain(node *shimast.Node) bool {
  if node == nil {
    return false
  }
  switch node.Kind {
  case shimast.KindPropertyAccessExpression:
    access := node.AsPropertyAccessExpression()
    if access != nil && access.QuestionDotToken != nil {
      return true
    }
    if access != nil {
      return containsOptionalChain(access.Expression)
    }
  case shimast.KindElementAccessExpression:
    access := node.AsElementAccessExpression()
    if access != nil && access.QuestionDotToken != nil {
      return true
    }
    if access != nil {
      return containsOptionalChain(access.Expression)
    }
  case shimast.KindCallExpression:
    call := node.AsCallExpression()
    if call != nil && call.QuestionDotToken != nil {
      return true
    }
    if call != nil {
      return containsOptionalChain(call.Expression)
    }
  }
  return false
}

// noMisusedNew: declaring a `new` signature on a non-class interface
// or a `constructor` method on an interface — these don't do what
// authors expect.
type noMisusedNew struct{}

func (noMisusedNew) Name() string { return "no-misused-new" }
func (noMisusedNew) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindInterfaceDeclaration, shimast.KindTypeAliasDeclaration}
}
func (noMisusedNew) Check(ctx *Context, node *shimast.Node) {
  if node.Kind != shimast.KindInterfaceDeclaration {
    return
  }
  decl := node.AsInterfaceDeclaration()
  if decl == nil || decl.Members == nil {
    return
  }
  for _, member := range decl.Members.Nodes {
    if member == nil {
      continue
    }
    switch member.Kind {
    case shimast.KindConstructor:
      ctx.Report(member, "Interfaces cannot have constructors. Use a class instead.")
    case shimast.KindMethodSignature:
      ms := member.AsMethodSignatureDeclaration()
      if ms != nil && identifierText(ms.Name()) == "constructor" {
        ctx.Report(member, "Interfaces cannot have constructors. Use a class instead.")
      }
    }
  }
}

// noUnnecessaryParameterPropertyAssignment: parameter properties already
// assign the constructor argument to `this.<name>` before the body runs.
// A body-level `this.x = x` immediately repeats that initialization.
type noUnnecessaryParameterPropertyAssignment struct{}

func (noUnnecessaryParameterPropertyAssignment) Name() string {
  return "no-unnecessary-parameter-property-assignment"
}
func (noUnnecessaryParameterPropertyAssignment) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindConstructor}
}
func (noUnnecessaryParameterPropertyAssignment) Check(ctx *Context, node *shimast.Node) {
  parameterProperties := map[string]bool{}
  for _, param := range node.Parameters() {
    name, ok := parameterPropertyName(param)
    if ok {
      parameterProperties[name] = true
    }
  }
  if len(parameterProperties) == 0 {
    return
  }
  body := node.Body()
  if body == nil || body.Kind != shimast.KindBlock {
    return
  }
  block := body.AsBlock()
  if block == nil || block.Statements == nil {
    return
  }
  assigned := map[string]bool{}
  for _, stmt := range block.Statements.Nodes {
    property, value, ok := thisPropertyAssignment(stmt)
    if !ok {
      continue
    }
    if parameterProperties[property] && !assigned[property] && value == property {
      ctx.Report(stmt, "This assignment repeats the constructor parameter property initialization.")
    }
    assigned[property] = true
  }
}

func parameterPropertyName(param *shimast.Node) (string, bool) {
  if param == nil || param.Kind != shimast.KindParameter {
    return "", false
  }
  if !isParameterProperty(param) {
    return "", false
  }
  decl := param.AsParameterDeclaration()
  if decl == nil {
    return "", false
  }
  name := identifierText(decl.Name())
  return name, name != ""
}

func isParameterProperty(param *shimast.Node) bool {
  return hasModifier(param, shimast.KindPublicKeyword) ||
    hasModifier(param, shimast.KindPrivateKeyword) ||
    hasModifier(param, shimast.KindProtectedKeyword) ||
    hasModifier(param, shimast.KindReadonlyKeyword) ||
    hasModifier(param, shimast.KindOverrideKeyword)
}

func thisPropertyAssignment(stmt *shimast.Node) (property string, value string, ok bool) {
  if stmt == nil || stmt.Kind != shimast.KindExpressionStatement {
    return "", "", false
  }
  exprStmt := stmt.AsExpressionStatement()
  if exprStmt == nil || exprStmt.Expression == nil {
    return "", "", false
  }
  expr := stripParens(exprStmt.Expression)
  if expr == nil || expr.Kind != shimast.KindBinaryExpression {
    return "", "", false
  }
  binary := expr.AsBinaryExpression()
  if binary == nil || binary.OperatorToken == nil || binary.OperatorToken.Kind != shimast.KindEqualsToken {
    return "", "", false
  }
  left := stripParens(binary.Left)
  if left == nil || left.Kind != shimast.KindPropertyAccessExpression {
    return "", "", false
  }
  access := left.AsPropertyAccessExpression()
  if access == nil || access.Expression == nil || access.Expression.Kind != shimast.KindThisKeyword {
    return "", "", false
  }
  property = identifierText(access.Name())
  value = identifierText(stripParens(binary.Right))
  if property == "" {
    return "", "", false
  }
  return property, value, true
}

// preferEnumInitializers: every enum member should have an explicit
// initializer (avoids order-dependent values).
type preferEnumInitializers struct{}

func (preferEnumInitializers) Name() string { return "prefer-enum-initializers" }
func (preferEnumInitializers) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindEnumDeclaration}
}
func (preferEnumInitializers) Check(ctx *Context, node *shimast.Node) {
  decl := node.AsEnumDeclaration()
  if decl == nil || decl.Members == nil {
    return
  }
  for _, member := range decl.Members.Nodes {
    if member == nil {
      continue
    }
    em := member.AsEnumMember()
    if em != nil && em.Initializer == nil {
      ctx.Report(member, "Enum member should have an explicit initializer.")
    }
  }
}

// preferForOf: `for (let i = 0; i < arr.length; i++) { use(arr[i]) }`
// can usually be replaced with `for (const x of arr) { use(x); }`.
type preferForOf struct{}

func (preferForOf) Name() string           { return "prefer-for-of" }
func (preferForOf) Visits() []shimast.Kind { return []shimast.Kind{shimast.KindForStatement} }
func (preferForOf) Check(ctx *Context, node *shimast.Node) {
  loop := node.AsForStatement()
  if loop == nil || loop.Initializer == nil || loop.Condition == nil || loop.Incrementor == nil {
    return
  }
  // Initializer: `let i = 0` (single declarator with name `i`).
  init := loop.Initializer
  if init.Kind != shimast.KindVariableDeclarationList {
    return
  }
  list := init.AsVariableDeclarationList()
  if list == nil || list.Declarations == nil || len(list.Declarations.Nodes) != 1 {
    return
  }
  decl := list.Declarations.Nodes[0].AsVariableDeclaration()
  if decl == nil {
    return
  }
  counter := identifierText(decl.Name())
  if counter == "" {
    return
  }
  if numericLiteralText(decl.Initializer) != "0" {
    return
  }
  // Condition: `i < <something>.length`.
  cond := loop.Condition.AsBinaryExpression()
  if cond == nil || cond.OperatorToken == nil {
    return
  }
  if cond.OperatorToken.Kind != shimast.KindLessThanToken {
    return
  }
  if identifierText(cond.Left) != counter {
    return
  }
  if cond.Right == nil || cond.Right.Kind != shimast.KindPropertyAccessExpression {
    return
  }
  rightAccess := cond.Right.AsPropertyAccessExpression()
  if rightAccess == nil || identifierText(rightAccess.Name()) != "length" {
    return
  }
  // Incrementor: `i++` or `++i`.
  if !isCounterIncrement(loop.Incrementor, counter) {
    return
  }
  ctx.Report(node, "Prefer a 'for-of' loop instead of a 'for' loop with this simple iteration.")
}

// isCounterIncrement reports whether node is a prefix or postfix `++`
// applied to the identifier named counter. Used by prefer-for-of.
func isCounterIncrement(node *shimast.Node, counter string) bool {
  switch node.Kind {
  case shimast.KindPostfixUnaryExpression:
    post := node.AsPostfixUnaryExpression()
    return post != nil && post.Operator == shimast.KindPlusPlusToken && identifierText(post.Operand) == counter
  case shimast.KindPrefixUnaryExpression:
    pre := node.AsPrefixUnaryExpression()
    return pre != nil && pre.Operator == shimast.KindPlusPlusToken && identifierText(pre.Operand) == counter
  }
  return false
}

// preferFunctionType: a single-call-signature interface or type alias
// is more readably written as a function type.
//
//  interface F { (x: number): string }   -> type F = (x: number) => string
type preferFunctionType struct{}

func (preferFunctionType) Name() string { return "prefer-function-type" }
func (preferFunctionType) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindInterfaceDeclaration}
}
func (preferFunctionType) Check(ctx *Context, node *shimast.Node) {
  decl := node.AsInterfaceDeclaration()
  if decl == nil || decl.Members == nil || len(decl.Members.Nodes) != 1 {
    return
  }
  if decl.HeritageClauses != nil && len(decl.HeritageClauses.Nodes) > 0 {
    return
  }
  member := decl.Members.Nodes[0]
  if member == nil || member.Kind != shimast.KindCallSignature {
    return
  }
  ctx.Report(node, "Interface only has a call signature; use 'type' alias and function type instead.")
}

// methodSignatureStyle: prefer function-property signatures over method
// shorthand in interfaces and type literals. This implements the default
// @typescript-eslint mode (`property`) as a diagnostic-only rule.
type methodSignatureStyle struct{}

func (methodSignatureStyle) Name() string { return "method-signature-style" }
func (methodSignatureStyle) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindMethodSignature}
}
func (methodSignatureStyle) Check(ctx *Context, node *shimast.Node) {
  if node.Parent == nil {
    return
  }
  switch node.Parent.Kind {
  case shimast.KindInterfaceDeclaration, shimast.KindTypeLiteral:
    ctx.Report(node, "Use a function-property signature instead of a method signature.")
  }
}

// preferNamespaceKeyword: `module Foo {}` (TS namespace via `module`
// keyword) → `namespace Foo {}`.
type preferNamespaceKeyword struct{}

func (preferNamespaceKeyword) Name() string { return "prefer-namespace-keyword" }
func (preferNamespaceKeyword) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindModuleDeclaration}
}
func (preferNamespaceKeyword) Check(ctx *Context, node *shimast.Node) {
  decl := node.AsModuleDeclaration()
  if decl == nil || decl.Name() == nil {
    return
  }
  if decl.Name().Kind == shimast.KindStringLiteral {
    return // ambient module: `declare module "fs" {}` is fine
  }
  if decl.Keyword != shimast.KindModuleKeyword {
    return
  }
  message := "Use 'namespace' instead of 'module' to declare custom TypeScript modules."
  start := keywordStart(ctx.File, node, "module")
  if start < 0 {
    ctx.Report(node, message)
    return
  }
  ctx.ReportFix(
    node,
    message,
    TextEdit{Pos: start, End: start + len("module"), Text: "namespace"},
  )
}

// tripleSlashReference: `/// <reference path="..." />` directives.
// Discouraged in modern code in favor of `import`.
type tripleSlashReference struct{}

func (tripleSlashReference) Name() string           { return "triple-slash-reference" }
func (tripleSlashReference) Visits() []shimast.Kind { return []shimast.Kind{shimast.KindSourceFile} }
func (tripleSlashReference) Check(ctx *Context, node *shimast.Node) {
  if ctx.File == nil {
    return
  }
  for _, ref := range ctx.File.ReferencedFiles {
    ctx.ReportRange(ref.Pos(), ref.End(), "Do not use triple slash references for "+ref.FileName+".")
  }
  for _, ref := range ctx.File.TypeReferenceDirectives {
    ctx.ReportRange(ref.Pos(), ref.End(), "Do not use triple slash references for "+ref.FileName+".")
  }
}

// noArrayDelete: `delete arr[0]` leaves a sparse hole. Use `splice`.
type noArrayDelete struct{}

func (noArrayDelete) Name() string           { return "no-array-delete" }
func (noArrayDelete) Visits() []shimast.Kind { return []shimast.Kind{shimast.KindDeleteExpression} }
func (noArrayDelete) Check(ctx *Context, node *shimast.Node) {
  del := node.AsDeleteExpression()
  if del == nil || del.Expression == nil {
    return
  }
  if del.Expression.Kind != shimast.KindElementAccessExpression {
    return
  }
  access := del.Expression.AsElementAccessExpression()
  if access == nil || access.ArgumentExpression == nil {
    return
  }
  // Numeric subscript ⇒ likely-array delete. (Object delete via
  // numeric key is rare.)
  switch access.ArgumentExpression.Kind {
  case shimast.KindNumericLiteral, shimast.KindIdentifier:
    ctx.Report(node, "Using delete with an array expression is unsafe.")
  }
}

// consistentTypeImports: `import { Foo } from "./types"` where Foo is
// only used as a type → `import type { Foo } from "./types"`. We
// approximate by flagging every `import type` candidate where the
// specifier appears in a type-only context inside the file.
//
// We use a heuristic: if every reference to an imported name occurs
// only inside a TypeReferenceNode, flag the import. Falls short on
// unanalyzable shapes (re-exports, `typeof X`) but matches the most
// common case.
type consistentTypeImports struct{}

func (consistentTypeImports) Name() string { return "consistent-type-imports" }
func (consistentTypeImports) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindImportDeclaration}
}
func (consistentTypeImports) Check(ctx *Context, node *shimast.Node) {
  decl := node.AsImportDeclaration()
  if decl == nil || decl.ImportClause == nil {
    return
  }
  clause := decl.ImportClause.AsImportClause()
  if clause == nil {
    return
  }
  if clause.PhaseModifier == shimast.KindTypeKeyword {
    return // already `import type`.
  }
  if clause.NamedBindings == nil || clause.NamedBindings.Kind != shimast.KindNamedImports {
    return
  }
  named := clause.NamedBindings.AsNamedImports()
  if named == nil || named.Elements == nil {
    return
  }
  names := []string{}
  for _, spec := range named.Elements.Nodes {
    if spec == nil {
      continue
    }
    s := spec.AsImportSpecifier()
    if s == nil || s.IsTypeOnly {
      continue
    }
    if name := identifierText(s.Name()); name != "" {
      names = append(names, name)
    }
  }
  if len(names) == 0 {
    return
  }
  if !allUsesAreTypeOnly(ctx.File.AsNode(), names) {
    return
  }
  ctx.Report(node, "All imports in the declaration are only used as types. Use `import type`.")
}

// allUsesAreTypeOnly reports whether every reference to any of the given
// names in the subtree rooted at root occurs inside a type-only position
// (TypeReferenceNode, TypeAliasDeclaration, InterfaceDeclaration, etc.).
// A reference inside another ImportDeclaration is skipped entirely.
// Returns false as soon as a value-position reference is found.
func allUsesAreTypeOnly(root *shimast.Node, names []string) bool {
  want := map[string]bool{}
  for _, n := range names {
    want[n] = true
  }
  allOk := true
  var visit func(n *shimast.Node, inType bool)
  visit = func(n *shimast.Node, inType bool) {
    if n == nil || !allOk {
      return
    }
    typeContext := inType
    switch n.Kind {
    case shimast.KindTypeReference,
      shimast.KindTypeAliasDeclaration,
      shimast.KindInterfaceDeclaration,
      shimast.KindTypeQuery,
      shimast.KindTypeOperator,
      shimast.KindTypeLiteral:
      typeContext = true
    case shimast.KindIdentifier:
      if !typeContext && want[identifierText(n)] {
        allOk = false
        return
      }
    case shimast.KindImportDeclaration:
      return // don't descend into other imports
    }
    n.ForEachChild(func(c *shimast.Node) bool {
      visit(c, typeContext)
      return false
    })
  }
  visit(root, false)
  return allOk
}

// noEmptyObjectType: `interface Foo {}` / `type Foo = {}`. ESLint
// flags empty types because they're equivalent to `unknown` (everything
// satisfies `{}`).
type noEmptyObjectType struct{}

func (noEmptyObjectType) Name() string           { return "no-empty-object-type" }
func (noEmptyObjectType) Visits() []shimast.Kind { return []shimast.Kind{shimast.KindTypeLiteral} }
func (noEmptyObjectType) Check(ctx *Context, node *shimast.Node) {
  lit := node.AsTypeLiteralNode()
  if lit == nil || lit.Members == nil {
    return
  }
  if len(lit.Members.Nodes) == 0 {
    ctx.Report(node, "The `{}` type is generally not what's intended; consider `Record<string, unknown>` or `unknown`.")
  }
}

// arrayType: `Array<T>` vs `T[]`. ESLint default mode prefers `T[]`.
type arrayType struct{}

func (arrayType) Name() string           { return "array-type" }
func (arrayType) Visits() []shimast.Kind { return []shimast.Kind{shimast.KindTypeReference} }
func (arrayType) Check(ctx *Context, node *shimast.Node) {
  ref := node.AsTypeReferenceNode()
  if ref == nil || ref.TypeName == nil {
    return
  }
  name := identifierText(ref.TypeName)
  if name != "Array" && name != "ReadonlyArray" {
    return
  }
  if ref.TypeArguments == nil || len(ref.TypeArguments.Nodes) != 1 {
    return
  }
  if name == "Array" {
    ctx.Report(node, "Use 'T[]' instead of 'Array<T>'.")
  } else {
    ctx.Report(node, "Use 'readonly T[]' instead of 'ReadonlyArray<T>'.")
  }
}

// consistentIndexedObjectStyle: `{ [key: string]: T }` vs
// `Record<string, T>`. ESLint default prefers `Record`.
type consistentIndexedObjectStyle struct{}

func (consistentIndexedObjectStyle) Name() string { return "consistent-indexed-object-style" }
func (consistentIndexedObjectStyle) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindTypeLiteral}
}
func (consistentIndexedObjectStyle) Check(ctx *Context, node *shimast.Node) {
  lit := node.AsTypeLiteralNode()
  if lit == nil || lit.Members == nil || len(lit.Members.Nodes) != 1 {
    return
  }
  member := lit.Members.Nodes[0]
  if member == nil || member.Kind != shimast.KindIndexSignature {
    return
  }
  ctx.Report(node, "An index signature is preferred to be a Record type.")
}

// no-explicit-any-rest-parameter — keeping this distinct from
// noExplicitAny: rest parameters typed `...args: any[]` are common
// enough that users want to allow them; this rule lets them ban that
// shape specifically.
//
// (Skipped: too narrow / overlaps with no-explicit-any.)

// banTslintComment: `// tslint:disable`. tslint is dead; comments
// referencing it should be cleaned up.
type banTslintComment struct{}

func (banTslintComment) Name() string           { return "ban-tslint-comment" }
func (banTslintComment) Visits() []shimast.Kind { return []shimast.Kind{shimast.KindSourceFile} }
func (banTslintComment) Check(ctx *Context, node *shimast.Node) {
  if ctx.File == nil {
    return
  }
  text := ctx.File.Text()
  for i := 0; i < len(text)-2; i++ {
    if text[i] == '/' && text[i+1] == '/' {
      // Find end of line.
      end := i
      for end < len(text) && text[end] != '\n' {
        end++
      }
      line := text[i:end]
      if strings.Contains(line, "tslint:") {
        ctx.ReportRange(i, end, "tslint comment detected.")
      }
      i = end
    }
  }
}

// adjacentOverloadSignatures: function/method overloads must be
// declared next to each other. ESLint catches the visual confusion
// when overloads are interleaved with other members.
type adjacentOverloadSignatures struct{}

func (adjacentOverloadSignatures) Name() string { return "adjacent-overload-signatures" }
func (adjacentOverloadSignatures) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindInterfaceDeclaration, shimast.KindTypeLiteral, shimast.KindClassDeclaration, shimast.KindClassExpression, shimast.KindModuleBlock, shimast.KindSourceFile}
}
func (adjacentOverloadSignatures) Check(ctx *Context, node *shimast.Node) {
  members := containerMembers(node)
  if len(members) == 0 {
    return
  }
  type entry struct {
    index int
    name  string
    kind  shimast.Kind
  }
  seen := []entry{}
  for i, m := range members {
    name, kind, ok := overloadName(m)
    if !ok {
      continue
    }
    for _, prev := range seen {
      if prev.name == name && prev.kind == kind && prev.index < i-1 {
        // Check there isn't already a same-name entry adjacent.
        if i > 0 {
          prevName, prevKind, _ := overloadName(members[i-1])
          if prevName == name && prevKind == kind {
            break
          }
        }
        ctx.Report(m, "All "+name+" signatures should be adjacent.")
        break
      }
    }
    seen = append(seen, entry{index: i, name: name, kind: kind})
  }
}

// containerMembers returns the direct child member/statement list of a
// container node (interface, type literal, class, module block, or source
// file). Returns nil for node kinds that don't have member lists.
func containerMembers(node *shimast.Node) []*shimast.Node {
  switch node.Kind {
  case shimast.KindInterfaceDeclaration:
    decl := node.AsInterfaceDeclaration()
    if decl != nil && decl.Members != nil {
      return decl.Members.Nodes
    }
  case shimast.KindTypeLiteral:
    lit := node.AsTypeLiteralNode()
    if lit != nil && lit.Members != nil {
      return lit.Members.Nodes
    }
  case shimast.KindClassDeclaration:
    decl := node.AsClassDeclaration()
    if decl != nil && decl.Members != nil {
      return decl.Members.Nodes
    }
  case shimast.KindClassExpression:
    decl := node.AsClassExpression()
    if decl != nil && decl.Members != nil {
      return decl.Members.Nodes
    }
  case shimast.KindModuleBlock:
    mb := node.AsModuleBlock()
    if mb != nil && mb.Statements != nil {
      return mb.Statements.Nodes
    }
  case shimast.KindSourceFile:
    f := node.AsSourceFile()
    if f != nil && f.Statements != nil {
      return f.Statements.Nodes
    }
  }
  return nil
}

// overloadName extracts the canonical name and kind of an overloadable
// member node. Returns (name, kind, true) for method signatures, method
// declarations, function declarations, call signatures, and construct
// signatures; otherwise returns ("", 0, false). Call and construct
// signatures use a synthesized name that includes the kind string so
// they compare equal only to other signatures of the same shape.
func overloadName(m *shimast.Node) (string, shimast.Kind, bool) {
  if m == nil {
    return "", 0, false
  }
  switch m.Kind {
  case shimast.KindMethodSignature:
    ms := m.AsMethodSignatureDeclaration()
    if ms != nil {
      return identifierText(ms.Name()), m.Kind, true
    }
  case shimast.KindMethodDeclaration:
    md := m.AsMethodDeclaration()
    if md != nil {
      return identifierText(md.Name()), m.Kind, true
    }
  case shimast.KindFunctionDeclaration:
    fd := m.AsFunctionDeclaration()
    if fd != nil {
      return identifierText(fd.Name()), m.Kind, true
    }
  case shimast.KindCallSignature, shimast.KindConstructSignature:
    return "(" + m.Kind.String() + ")", m.Kind, true
  }
  return "", 0, false
}

func init() {
  Register(noConfusingNonNullAssertion{})
  Register(noDuplicateEnumValues{})
  Register(noMixedEnums{})
  Register(noExtraNonNullAssertion{})
  Register(noNonNullAssertedOptionalChain{})
  Register(noMisusedNew{})
  Register(noUnnecessaryParameterPropertyAssignment{})
  Register(preferEnumInitializers{})
  Register(preferForOf{})
  Register(preferFunctionType{})
  Register(methodSignatureStyle{})
  Register(preferNamespaceKeyword{})
  Register(tripleSlashReference{})
  Register(noArrayDelete{})
  Register(consistentTypeImports{})
  Register(noEmptyObjectType{})
  Register(arrayType{})
  Register(consistentIndexedObjectStyle{})
  Register(banTslintComment{})
  Register(adjacentOverloadSignatures{})
}
