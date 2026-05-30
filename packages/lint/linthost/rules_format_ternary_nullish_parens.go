package linthost

import (
  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimscanner "github.com/microsoft/typescript-go/shim/scanner"
)

// formatTernaryNullishParens parenthesizes a `??` expression used as the
// condition, consequent, or alternate of a conditional expression,
// matching Prettier 3. TypeScript permits an unparenthesized `??` in
// those positions (unlike `??` mixed with `||`/`&&`), but Prettier 3
// always adds the parens for clarity:
//
//  cond ? a ?? b : c   ->   cond ? (a ?? b) : c
//  a ?? b ? c : d      ->   (a ?? b) ? c : d
//
// Only `??` is wrapped; `||` and `&&` operands are left bare. The wrap is
// width-independent (it applies even when the ternary fits on one line),
// so it is a normalization rule rather than part of the print-width
// reflow. Idempotent: a wrapped operand parses as a parenthesized
// expression, not a bare `??`, so the next pass leaves it alone.
type formatTernaryNullishParens struct{}

func (formatTernaryNullishParens) Name() string   { return "format/ternary-nullish-parens" }
func (formatTernaryNullishParens) IsFormat() bool { return true }

func (formatTernaryNullishParens) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindConditionalExpression}
}

func (formatTernaryNullishParens) Check(ctx *Context, node *shimast.Node) {
  if ctx == nil || ctx.File == nil || node == nil {
    return
  }
  cond := node.AsConditionalExpression()
  if cond == nil {
    return
  }
  src := ctx.File.Text()
  var edits []TextEdit
  for _, operand := range []*shimast.Node{cond.Condition, cond.WhenTrue, cond.WhenFalse} {
    if !isBareNullishCoalescing(operand) {
      continue
    }
    start := shimscanner.SkipTrivia(src, operand.Pos())
    end := operand.End()
    if start < 0 || end < start || end > len(src) {
      continue
    }
    edits = append(edits, TextEdit{Pos: start, End: end, Text: "(" + src[start:end] + ")"})
  }
  if len(edits) == 0 {
    return
  }
  ctx.ReportRangeFix(
    edits[0].Pos,
    edits[0].End,
    "Parenthesize a nullish-coalescing operand of a conditional expression.",
    edits...,
  )
}

// isBareNullishCoalescing reports whether `node` is an unparenthesized
// `a ?? b` binary expression.
func isBareNullishCoalescing(node *shimast.Node) bool {
  if node == nil || node.Kind != shimast.KindBinaryExpression {
    return false
  }
  bin := node.AsBinaryExpression()
  return bin != nil &&
    bin.OperatorToken != nil &&
    bin.OperatorToken.Kind == shimast.KindQuestionQuestionToken
}

func init() {
  Register(formatTernaryNullishParens{})
}
