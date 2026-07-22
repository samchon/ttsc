package linthost

import (
  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// printControlFlowStatement renders a loop or an `if` by keeping its header
// exactly as written and laying out the block it controls.
//
// A block body holds a hardline after `{` in every layout Prettier produces, so
// a reflow that reaches into one has to be able to express it. Nine statement
// kinds had no printer, which meant `printBlock` dispatched them to `verbatim`
// and a body containing any of them stayed frozen at its source width while the
// body around it expanded — the half-expanded shape #922's first attempt
// produced and was reverted for.
//
// The header is sliced verbatim rather than laid out. `format/clause-join` owns
// the gap between a clause header and its body, and a printer that reflowed
// `for (…)` would put the two rules in disagreement over the same bytes.
//
// A BRACELESS body is left alone entirely. Prettier indents it one level past
// the header, which is layout the block-depth model has no frame for, and
// `format/indent` cedes it for exactly that reason (`cededUnderBracelessBody`).
// Dispatching it here would reintroduce the disagreement that guard exists to
// prevent.
//
// The second return value is the `covered` flag: see PrintNode.
func printControlFlowStatement(ctx *PrintContext, node *shimast.Node) (Doc, bool) {
  if node == nil {
    return Doc{}, true
  }
  body := controlFlowBody(node)
  if body == nil || body.Kind != shimast.KindBlock {
    return verbatim(ctx, node), !nodeSpansMultipleLines(ctx, node)
  }
  // A comment between the header and the body rides inside the verbatim prefix
  // and survives; one after the body's close brace would not, so the guard the
  // sibling printers carry applies here for the same reason.
  if listHasInterItemComments(ctx, node) {
    return verbatim(ctx, node), false
  }
  return printFunctionLike(ctx, node, body)
}

// controlFlowBody returns the single statement a loop or `if` controls, or nil
// when the node has more than one such body.
//
// An `if` with an `else` has two, and a `try` has up to three. Both are left to
// `verbatim` here: laying them out means minting the `else` and `catch`
// keywords between the parts, which is a different printer than "prefix plus
// one body" and belongs with its own tests rather than folded in beside the
// loops.
func controlFlowBody(node *shimast.Node) *shimast.Node {
  switch node.Kind {
  case shimast.KindForStatement:
    if s := node.AsForStatement(); s != nil {
      return s.Statement
    }
  case shimast.KindForOfStatement, shimast.KindForInStatement:
    if s := node.AsForInOrOfStatement(); s != nil {
      return s.Statement
    }
  case shimast.KindWhileStatement:
    if s := node.AsWhileStatement(); s != nil {
      return s.Statement
    }
  case shimast.KindIfStatement:
    if s := node.AsIfStatement(); s != nil && s.ElseStatement == nil {
      return s.ThenStatement
    }
  }
  return nil
}
