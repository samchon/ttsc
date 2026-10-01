// typescript/no-magic-numbers: TS-aware extension of the core
// `no-magic-numbers` rule. Numeric literals that appear inline in
// expressions tend to be unexplained constants — `if (count > 86400)`
// is opaque, `if (count > SECONDS_PER_DAY)` is not. The rule asks the
// author to lift those values into a named constant or enum.
// typescript-eslint:
// https://typescript-eslint.io/rules/no-magic-numbers/
//
// AST-only. The trigger is a `KindNumericLiteral` (or a numeric literal
// wrapped in a unary `+` / `-`). The TS variant differs from the core
// rule in one detail that this implementation enforces: numeric
// literals used as enum member initializers are NOT magic — an
// `enum Status { OK = 200 }` declaration IS the lifting step the rule
// pushes authors toward, so flagging the `200` would be backwards.
//
// Type-position numeric literals are also skipped: a literal that
// appears inside a `KindLiteralType` (e.g. `type N = 5`) is a type, not
// a runtime constant, and the rule's concern is runtime magic numbers.
// The well-known unit values `-1`, `0`, and `1` pass through because
// they almost always carry intrinsic meaning (sentinel, identity,
// step) and treating them as magic produces only noise.
package linthost

import (
  shimast "github.com/microsoft/typescript-go/shim/ast"
)

type tsNoMagicNumbers struct{}

func (tsNoMagicNumbers) Name() string { return "typescript/no-magic-numbers" }
func (tsNoMagicNumbers) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindNumericLiteral}
}
func (tsNoMagicNumbers) Check(ctx *Context, node *shimast.Node) {
  if node == nil {
    return
  }
  // Identify the surface node that represents the numeric value:
  // either the literal itself or the wrapping `+lit` / `-lit` unary.
  surface := node
  if parent := node.Parent; parent != nil && parent.Kind == shimast.KindPrefixUnaryExpression {
    prefix := parent.AsPrefixUnaryExpression()
    if prefix != nil && (prefix.Operator == shimast.KindMinusToken || prefix.Operator == shimast.KindPlusToken) && prefix.Operand == node {
      surface = parent
    }
  }
  // Skip when the literal lives inside a type position. A literal type
  // (`type N = 5`, `Array<10>`) is not a runtime constant — the
  // rule's concern is unexplained runtime values.
  if isInsideTypePosition(surface) {
    return
  }
  // TS extension: enum member initializers are themselves the named
  // constant the rule is asking for. `enum S { OK = 200 }` lifts the
  // value into `S.OK`; flagging the `200` would push authors to
  // double-wrap an already-named constant.
  if isEnumMemberInitializer(surface) {
    return
  }
  // Whitelisted unit values: -1 / 0 / 1 carry intrinsic meaning (not
  // found, identity, step) in almost every codebase. Treating them as
  // magic produces only noise.
  if isWellKnownUnitNumber(ctx.File, surface) {
    return
  }
  ctx.Report(surface, "No magic number: extract into a named constant or enum member.")
}

// isEnumMemberInitializer reports whether surface is the initializer
// expression of an enum member (`enum X { A = 1 }`). The literal node
// itself (or its unary wrapper) is the EnumMember.Initializer in that
// case, which is exactly the position the TS extension whitelists.
func isEnumMemberInitializer(surface *shimast.Node) bool {
  parent := surface.Parent
  if parent == nil || parent.Kind != shimast.KindEnumMember {
    return false
  }
  member := parent.AsEnumMember()
  return member != nil && member.Initializer == surface
}

// isInsideTypePosition reports whether `surface` is reached only
// through type-syntax ancestors before hitting a value-bearing node.
// Literal types, type arguments, and type aliases are type positions;
// the rule has nothing to say about literals that never reach runtime.
func isInsideTypePosition(surface *shimast.Node) bool {
  for p := surface.Parent; p != nil; p = p.Parent {
    switch p.Kind {
    case shimast.KindLiteralType,
      shimast.KindTypeReference,
      shimast.KindTypeAliasDeclaration,
      shimast.KindUnionType,
      shimast.KindIntersectionType,
      shimast.KindTypeOperator,
      shimast.KindIndexedAccessType,
      shimast.KindMappedType,
      shimast.KindConditionalType,
      shimast.KindTypeParameter:
      return true
    case shimast.KindPrefixUnaryExpression,
      shimast.KindParenthesizedExpression:
      continue
    }
    return false
  }
  return false
}

// isWellKnownUnitNumber reports whether `surface` is the literal `0`,
// `1`, or `-1`. The match is on source text to keep handling of `0.0`
// vs `0` and `1e0` vs `1` consistent with what the author actually
// wrote — only the bare textual form is whitelisted.
func isWellKnownUnitNumber(file *shimast.SourceFile, surface *shimast.Node) bool {
  text := nodeText(file, surface)
  switch text {
  case "0", "1", "-1":
    return true
  }
  return false
}

func init() {
  Register(tsNoMagicNumbers{})
}
