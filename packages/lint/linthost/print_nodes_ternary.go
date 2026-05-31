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
// nested conditional in its own Group. The outermost chain indents its arms
// by `tabWidth`. A nested chain in the ALTERNATE (`: `) position indents by a
// fixed 2 columns; a nested chain in the CONSEQUENT (`? `) position indents by
// `max(2, tabWidth)` (Prettier's extra `align(tabWidth-2)` on the consequent).
// So at tabWidth 4 the outer arms sit at column 4, an alternate-nested arm at
// column 6, and a consequent-nested arm at column 8; they coincide at tabWidth 2.
//
// The second return value is the coverage flag (see PrintNode): the AND
// of the test and both branches, so a multi-line verbatim node anywhere
// in the chain makes formatPrintWidth abstain rather than emit a
// half-reflowed shape.
func printConditionalExpression(ctx *PrintContext, node *shimast.Node) (Doc, bool) {
  body, covered := buildConditionalChain(ctx, node, ctx.indentUnit())
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
func buildConditionalChain(ctx *PrintContext, node *shimast.Node, indentCols int) (Doc, bool) {
  cond := node.AsConditionalExpression()
  if cond == nil || cond.Condition == nil || cond.WhenTrue == nil || cond.WhenFalse == nil {
    return Doc{}, true
  }
  // A comment around the `?`/`:` markers (`a ? /* c */ b : c`) would be dropped
  // by the minted "? "/": " text — the markers are not AST children, so a
  // nested conditional's gap comment slips past the top-level print-width scan
  // and is lost on reflow. Bail to verbatim and report UNCOVERED (hard `false`,
  // not `!nodeSpansMultipleLines`) so an enclosing reflow abstains instead of
  // breaking around this single-line verbatim conditional and moving it off its
  // line; the bytes survive.
  if listHasInterItemComments(ctx, node) {
    return verbatim(ctx, node), false
  }
  testDoc, c1 := PrintNode(ctx, cond.Condition)
  consDoc, c2 := ternaryArm(ctx, cond.WhenTrue, true)
  altDoc, c3 := ternaryArm(ctx, cond.WhenFalse, false)
  doc := Concat(
    testDoc,
    Indent(indentCols,
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
//
// A nested conditional in the CONSEQUENT (`? `) position is wrapped in
// parentheses, but only when the chain renders flat: Prettier's ternary-old
// printer emits `consequent.type === node.type ? ifBreak("", "(") : ""` around
// the consequent (`a ? (b ? c : d) : e` on one line), and drops the parens for
// the broken staircase. A nested conditional in the ALTERNATE (`: `) position
// is never wrapped — it chains. `isConsequent` selects between the two.
func ternaryArm(ctx *PrintContext, node *shimast.Node, isConsequent bool) (Doc, bool) {
  inner := node
  // A nested ternary written with explicit source parentheses — `a ? (b ? c : d)
  // : e` — is the same chain link as a bare nested ternary: Prettier's AST has no
  // ParenthesizedExpression node, so its `printTernary` sees the consequent as a
  // ConditionalExpression and joins the staircase (re-adding the parens only in
  // flat mode via ifBreak). Unwrap a parenthesized conditional so it chains too,
  // instead of printing flat inside kept parens. Only a ConditionalExpression
  // inner is unwrapped; `(a ?? b)` and other parenthesized expressions keep their
  // parens through the normal printer.
  // Do NOT unwrap when a comment sits between the parens and the inner
  // conditional (`(/* keep */ b ? c : d)`): dropping the ParenExpr wrapper would
  // delete that comment. Leaving `inner` as the ParenExpr routes it through the
  // normal printer, whose own self-guard bails to verbatim and preserves it.
  if inner != nil && inner.Kind == shimast.KindParenthesizedExpression &&
    !listHasInterItemComments(ctx, inner) {
    if p := inner.AsParenthesizedExpression(); p != nil && p.Expression != nil &&
      p.Expression.Kind == shimast.KindConditionalExpression {
      inner = p.Expression
    }
  }
  if inner != nil && inner.Kind == shimast.KindConditionalExpression {
    // A nested chain's arms align at 2 past their parent rung. Prettier's
    // ternary-old.js uses that as-is for an ALTERNATE-position nested chain
    // (`align(2)`), but a CONSEQUENT-position one gets an extra
    // `align(Math.max(0, tabWidth - 2))`, for a total of `max(2, tabWidth)`.
    // The two coincide at the default tabWidth 2; they diverge at tabWidth > 2.
    indentCols := 2
    if isConsequent {
      if u := ctx.indentUnit(); u > indentCols {
        indentCols = u
      }
    }
    chain, covered := buildConditionalChain(ctx, inner, indentCols)
    if isConsequent {
      // `ifBreak("", "(")` … `ifBreak("", ")")`: parens in flat mode only.
      chain = Concat(
        IfBreak(Doc{Kind: docNil}, Text("(")),
        chain,
        IfBreak(Doc{Kind: docNil}, Text(")")),
      )
    }
    return chain, covered
  }
  doc, covered := PrintNode(ctx, node)
  return Align(doc), covered
}
