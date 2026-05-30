package linthost

import (
  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// printConditionalExpression renders a (possibly chained) ternary with
// Prettier 3's "indent nested ternaries" staircase. A conditional whose
// consequent or alternate is itself a conditional is printed inline
// under the same break group, but its arms indent one extra level:
//
//  aaaaaaaaaa
//    ? bbbbbbbbbb
//    : cccccccccc
//      ? dddddddddd
//      : eeeeeeeeee
//
// The whole chain shares one fit-or-break decision (a single outer
// Group), matching Prettier: either the entire chain fits flat
// (`a ? b : c ? d : e`) or every rung breaks onto its own line. Nesting
// is expressed by recursing the chain builder without wrapping the
// nested conditional in its own Group, so the Doc engine's Indent stack
// accumulates `tabWidth` columns per level.
//
// The second return value is the coverage flag (see PrintNode): the AND
// of the test and both branches, so a multi-line verbatim node anywhere
// in the chain makes formatPrintWidth abstain rather than emit a
// half-reflowed shape.
func printConditionalExpression(ctx *PrintContext, node *shimast.Node) (Doc, bool) {
  body, covered := buildConditionalChain(ctx, node)
  if body.IsNil() {
    return verbatim(ctx, node), !nodeSpansMultipleLines(ctx, node)
  }
  return Group(body), covered
}

// buildConditionalChain returns the chain body for `node` WITHOUT a
// surrounding Group, so a nested conditional recursed from here shares
// the caller's group and its arms indent one level deeper. The top-level
// printConditionalExpression wraps the outermost body in the single
// Group that owns the break decision.
func buildConditionalChain(ctx *PrintContext, node *shimast.Node) (Doc, bool) {
  cond := node.AsConditionalExpression()
  if cond == nil || cond.Condition == nil || cond.WhenTrue == nil || cond.WhenFalse == nil {
    return Doc{}, true
  }
  testDoc, c1 := PrintNode(ctx, cond.Condition)
  consDoc, c2 := ternaryArm(ctx, cond.WhenTrue)
  altDoc, c3 := ternaryArm(ctx, cond.WhenFalse)
  doc := Concat(
    testDoc,
    Indent(ctx.indentUnit(),
      Line(), Text("? "), consDoc,
      Line(), Text(": "), altDoc,
    ),
  )
  return doc, c1 && c2 && c3
}

// ternaryArm prints a ternary consequent/alternate. A nested conditional
// continues the chain inline (no new Group) so the staircase
// accumulates; every other arm prints through the normal dispatcher (an
// arm that is a `??` expression is already parenthesized in valid
// source, so it round-trips its parens via the ParenthesizedExpression
// printer).
//
// A non-conditional arm is wrapped in Align so that, when it breaks
// internally, its continuation hangs under the arm expression's own
// column (one level past the `? `/`: ` marker) rather than under the
// chain's rung indent. Prettier hangs a broken call/object arm there:
//
//  cond
//    ? foo(
//        arg,        // arm-column + one level, not rung + one level
//      )
//    : bar
//
// Align is a no-op for an arm that stays flat, and a nested conditional
// is deliberately NOT aligned — it keeps the Indent-based staircase.
func ternaryArm(ctx *PrintContext, node *shimast.Node) (Doc, bool) {
  if node != nil && node.Kind == shimast.KindConditionalExpression {
    return buildConditionalChain(ctx, node)
  }
  doc, covered := PrintNode(ctx, node)
  return Align(doc), covered
}
