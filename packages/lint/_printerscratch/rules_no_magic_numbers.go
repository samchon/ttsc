// noMagicNumbers reports a numeric literal that appears in a position
// other than the initializer of a `const` declaration. Magic numbers
// scattered through expressions make a reader pause: a literal `60`
// inside a multiplication says nothing about whether it stands for
// seconds, frames, or items-per-page, while the same number bound to a
// `const SECONDS_PER_MINUTE = 60` carries its meaning along with it.
//
// Conservative baseline:
//
//   - Three numbers are silently ignored — `0`, `1`, and `-1`. The
//     first two are pervasive in counters and identity-style code; the
//     third is the canonical "not-found" return from `indexOf` and
//     similar APIs. Flagging them produces nothing but noise.
//   - A numeric literal that is the initializer of a `const x = …`
//     declaration is the named binding the rule is asking for, so it
//     is not flagged.
//   - A numeric literal that is the index of a `KindElementAccessExpression`
//     (`arr[0]`, `tuple[3]`) is treated as an array index and ignored;
//     ESLint's `ignoreArrayIndexes` option is on by default here.
//   - A numeric literal that initializes an `enum` member is the
//     binding's value, not a magic number — enums exist precisely to
//     give numeric values names, so the value position is the point of
//     the construct.
//
// https://eslint.org/docs/latest/rules/no-magic-numbers
package linthost

import (
  shimast "github.com/microsoft/typescript-go/shim/ast"
)

type noMagicNumbers struct{}

func (noMagicNumbers) Name() string { return "no-magic-numbers" }
func (noMagicNumbers) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindNumericLiteral}
}
func (noMagicNumbers) Check(ctx *Context, node *shimast.Node) {
  if node == nil {
    return
  }
  text := numericLiteralText(node)
  if isIgnoredMagicLiteralText(text) {
    return
  }
  parent := node.Parent
  if parent == nil {
    return
  }
  // `-N` is a PrefixUnaryExpression whose Operand is the literal. The
  // `-1` ignore list lives on the unary expression's combined text;
  // recognize the negated form here so the rule does not flag the `1`
  // inside `-1`.
  if parent.Kind == shimast.KindPrefixUnaryExpression {
    pre := parent.AsPrefixUnaryExpression()
    if pre != nil && pre.Operator == shimast.KindMinusToken && text == "1" {
      return
    }
  }
  // Initializer of a `const x = N` declaration: the named binding the
  // rule wants users to introduce.
  if isConstVariableInitializer(parent, node) {
    return
  }
  // Enum member value: `enum E { A = 0, B = 1 }` — the literal is
  // the binding's value position, so leave it alone.
  if parent.Kind == shimast.KindEnumMember {
    return
  }
  // `arr[0]` / `tuple[3]`: numeric index position of an element access.
  if isArrayIndexArgument(parent, node) {
    return
  }
  ctx.Report(node, "No magic number: "+text+".")
}

// isIgnoredMagicLiteralText reports whether the literal text falls into
// the always-ignored set. `-1` is handled by the caller (the leading
// minus lives on a PrefixUnaryExpression parent), so the table here only
// needs the two zero / one shapes.
func isIgnoredMagicLiteralText(text string) bool {
  switch text {
  case "0", "1":
    return true
  }
  return false
}

// isConstVariableInitializer reports whether `literal` sits in the
// Initializer slot of a `const x = literal` VariableDeclaration. `let`
// and `var` are deliberately excluded — a `let x = 60` binding can be
// reassigned, so the number is still magic in the position it was
// written.
func isConstVariableInitializer(parent, literal *shimast.Node) bool {
  if parent == nil || parent.Kind != shimast.KindVariableDeclaration {
    return false
  }
  decl := parent.AsVariableDeclaration()
  if decl == nil || decl.Initializer != literal {
    return false
  }
  return shimast.IsConst(parent)
}

// isArrayIndexArgument reports whether `literal` sits in the
// ArgumentExpression slot of a `target[literal]` ElementAccessExpression.
// ESLint calls this `ignoreArrayIndexes`; the rule's conservative
// baseline enables it because mixing numeric subscripts with renamed
// constants reads worse than the literal.
func isArrayIndexArgument(parent, literal *shimast.Node) bool {
  if parent == nil || parent.Kind != shimast.KindElementAccessExpression {
    return false
  }
  access := parent.AsElementAccessExpression()
  if access == nil {
    return false
  }
  return access.ArgumentExpression == literal
}

func init() {
  Register(noMagicNumbers{})
}
