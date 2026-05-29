// typescript/no-unsafe-enum-comparison: `===` / `!==` (and the `==` /
// `!=` cousins) silently accept any value that shares the widened
// primitive of an enum member. A string enum value compared with a raw
// string literal therefore matches whichever string happens to land in
// the other operand, even when the literal is not declared on the enum
// at all. The fix is to compare against one of the enum's own members
// so a typo surfaces at compile time.
// typescript-eslint:
// https://typescript-eslint.io/rules/no-unsafe-enum-comparison/
//
// Type-aware. Without a Checker we cannot tell an enum-typed value
// apart from a plain `string` / `number`, so Context.Checker == nil
// short-circuits the visit the same way every other type-aware rule
// in this package does.
//
// The matching algorithm mirrors typescript-eslint:
//
//   - one side must carry an enum type (TypeFlagsEnumLike — covers
//     both the enum union and its literal members);
//   - the other side must be the widened primitive (string-/number-/
//     bigint-like) WITHOUT carrying the same enum;
//   - `any`, `unknown`, `never`, and identical enums on both sides
//     pass through.
package linthost

import (
  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimchecker "github.com/microsoft/typescript-go/shim/checker"
)

type noUnsafeEnumComparison struct{}

func (noUnsafeEnumComparison) Name() string { return "typescript/no-unsafe-enum-comparison" }
func (noUnsafeEnumComparison) NeedsTypeChecker() bool {
  return true
}
func (noUnsafeEnumComparison) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindBinaryExpression}
}
func (noUnsafeEnumComparison) Check(ctx *Context, node *shimast.Node) {
  if ctx.Checker == nil {
    return
  }
  bin := node.AsBinaryExpression()
  if bin == nil || bin.OperatorToken == nil || bin.Left == nil || bin.Right == nil {
    return
  }
  switch bin.OperatorToken.Kind {
  case shimast.KindEqualsEqualsToken,
    shimast.KindEqualsEqualsEqualsToken,
    shimast.KindExclamationEqualsToken,
    shimast.KindExclamationEqualsEqualsToken:
  default:
    return
  }
  left := ctx.Checker.GetTypeAtLocation(bin.Left)
  right := ctx.Checker.GetTypeAtLocation(bin.Right)
  if left == nil || right == nil {
    return
  }
  if noUnsafeEnumComparisonMismatch(left, right) || noUnsafeEnumComparisonMismatch(right, left) {
    ctx.Report(node, "Unsafe comparison between an enum-typed value and a plain primitive of the same widened type. Compare against one of the enum's own members so a typo surfaces at compile time.")
  }
}

// noUnsafeEnumComparisonMismatch reports whether `enumSide` carries an
// enum type and `otherSide` is the widened primitive without naming the
// same enum. Both arms walk union constituents — a `Color | undefined`
// still counts as the enum side, and the comparison `color === "red"`
// is still unsafe even when `color` carries an extra nullish branch.
func noUnsafeEnumComparisonMismatch(enumSide, otherSide *shimchecker.Type) bool {
  if !noUnsafeEnumComparisonHasEnum(enumSide) {
    return false
  }
  // `any` / `unknown` / `never` on the other side silently propagate
  // from generic helpers — flagging them would explode false positives
  // the same way `restrict-template-expressions` mitigates with its
  // `allowAny` default.
  if noUnsafeEnumComparisonIsLoose(otherSide) {
    return false
  }
  // If the other side is provably the same enum (or one of its
  // members), the comparison is the safe shape the rule recommends.
  if noUnsafeEnumComparisonSharesEnum(enumSide, otherSide) {
    return false
  }
  // The mismatch only fires when the non-enum side is the widened
  // primitive that the enum widens to. A `Color === Status.Active`
  // comparison (two unrelated enums of the same widened number) also
  // trips this branch via the other call ordering.
  if !noUnsafeEnumComparisonIsBareLiteralLike(otherSide) && !noUnsafeEnumComparisonHasEnum(otherSide) {
    return false
  }
  return true
}

// noUnsafeEnumComparisonHasEnum reports whether t (or any constituent of
// a union) carries an enum-like flag. `TypeFlagsEnumLike` covers both
// the enum union type produced by `enum E { ... }` and the canonical
// `TypeFlagsEnumLiteral`-tagged literal types for each member.
func noUnsafeEnumComparisonHasEnum(t *shimchecker.Type) bool {
  if t == nil {
    return false
  }
  flags := t.Flags()
  if flags&shimchecker.TypeFlagsEnumLike != 0 {
    return true
  }
  if flags&(shimchecker.TypeFlagsUnion|shimchecker.TypeFlagsIntersection) != 0 {
    for _, part := range t.Types() {
      if noUnsafeEnumComparisonHasEnum(part) {
        return true
      }
    }
  }
  return false
}

// noUnsafeEnumComparisonIsLoose reports whether t propagates from a
// generic helper without naming a concrete type — `any` / `unknown` /
// `never`. The upstream rule keeps these silent so type-erasure paths
// (`JSON.parse`, untyped APIs) don't light up everywhere.
func noUnsafeEnumComparisonIsLoose(t *shimchecker.Type) bool {
  if t == nil {
    return true
  }
  return t.Flags()&(shimchecker.TypeFlagsAny|shimchecker.TypeFlagsUnknown|shimchecker.TypeFlagsNever) != 0
}

// noUnsafeEnumComparisonSharesEnum reports whether both sides refer to
// the same enum declaration. The Checker canonicalizes enum literal
// types per member, so identity follows the type's name symbol (or the
// enum union's symbol) up the parent chain to the EnumDeclaration node
// — comparing those addresses tells us whether `Color.Red` and
// `Color.Blue` come from the same enum.
func noUnsafeEnumComparisonSharesEnum(a, b *shimchecker.Type) bool {
  aDecl := noUnsafeEnumComparisonEnumDeclaration(a)
  bDecl := noUnsafeEnumComparisonEnumDeclaration(b)
  if aDecl == nil || bDecl == nil {
    return false
  }
  return aDecl == bDecl
}

// noUnsafeEnumComparisonEnumDeclaration returns the EnumDeclaration
// node that t (or any constituent of a union) belongs to, or nil when
// t is not an enum-flavored type. Both the enum union type and each
// enum-literal member carry the enum's symbol via Type.Symbol; the
// symbol's parent declaration is the EnumDeclaration we identify by.
func noUnsafeEnumComparisonEnumDeclaration(t *shimchecker.Type) *shimast.Node {
  if t == nil {
    return nil
  }
  flags := t.Flags()
  if flags&shimchecker.TypeFlagsEnumLike != 0 {
    sym := t.Symbol()
    if sym == nil {
      return nil
    }
    for _, decl := range sym.Declarations {
      if decl == nil {
        continue
      }
      if decl.Kind == shimast.KindEnumDeclaration {
        return decl
      }
      // Enum member literal types carry the member symbol; walk
      // one level up to land on the surrounding EnumDeclaration.
      if decl.Parent != nil && decl.Parent.Kind == shimast.KindEnumDeclaration {
        return decl.Parent
      }
    }
    return nil
  }
  if flags&(shimchecker.TypeFlagsUnion|shimchecker.TypeFlagsIntersection) != 0 {
    var seen *shimast.Node
    for _, part := range t.Types() {
      decl := noUnsafeEnumComparisonEnumDeclaration(part)
      if decl == nil {
        continue
      }
      if seen == nil {
        seen = decl
        continue
      }
      if seen != decl {
        return nil
      }
    }
    return seen
  }
  return nil
}

// noUnsafeEnumComparisonIsBareLiteralLike reports whether t is a plain
// primitive or primitive literal — the widened side of an enum
// comparison. Unions are considered bare when every constituent is.
// Pure `null` / `undefined` operands are exempt because they don't
// share an enum's primitive widening — `color === null` is a real
// nullability check, not a same-primitive mistake.
func noUnsafeEnumComparisonIsBareLiteralLike(t *shimchecker.Type) bool {
  if t == nil {
    return false
  }
  flags := t.Flags()
  if flags&shimchecker.TypeFlagsEnumLike != 0 {
    return false
  }
  const primitiveMask = shimchecker.TypeFlagsStringLike |
    shimchecker.TypeFlagsNumberLike |
    shimchecker.TypeFlagsBigIntLike
  if flags&primitiveMask != 0 {
    return true
  }
  if flags&(shimchecker.TypeFlagsUnion|shimchecker.TypeFlagsIntersection) != 0 {
    anyMatch := false
    for _, part := range t.Types() {
      if part == nil {
        continue
      }
      if noUnsafeEnumComparisonHasEnum(part) {
        return false
      }
      if noUnsafeEnumComparisonIsBareLiteralLike(part) {
        anyMatch = true
      }
    }
    return anyMatch
  }
  return false
}

func init() {
  Register(noUnsafeEnumComparison{})
}
