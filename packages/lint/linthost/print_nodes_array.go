package linthost

import (
  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// printArrayLiteral renders an ArrayLiteralExpression with width-aware
// fit-or-break. Like the object printer, elements are emitted verbatim
// — only the outer brackets and the inter-element commas participate
// in reflow.
//
// Flat:    `[1, 2, 3]`
// Broken:  `[
//
//     1,
//     2,
//     3,
//  ]`
//
// Array literals do NOT carry a leading/trailing space inside the
// brackets in flat mode (`[a, b]`, not `[ a, b ]`), matching every
// JavaScript formatter. Empty arrays collapse to `[]`.
//
// The second return value is the `covered` flag: see PrintNode. It is
// the AND of every element's coverage.
func printArrayLiteral(ctx *PrintContext, node *shimast.Node) (Doc, bool) {
  if node == nil {
    return Doc{}, true
  }
  arr := node.AsArrayLiteralExpression()
  if arr == nil || arr.Elements == nil {
    return verbatim(ctx, node), !nodeSpansMultipleLines(ctx, node)
  }
  // A comment between elements (or after `[`) would be dropped by the fresh
  // separators; bail to verbatim so the enclosing reflow abstains.
  if listHasInterItemComments(ctx, node) {
    return verbatim(ctx, node), !nodeSpansMultipleLines(ctx, node)
  }
  items := make([]Doc, 0, len(arr.Elements.Nodes))
  covered := true
  for _, elem := range arr.Elements.Nodes {
    if elem == nil {
      return verbatim(ctx, node), !nodeSpansMultipleLines(ctx, node)
    }
    doc, childCovered := PrintNode(ctx, elem)
    covered = covered && childCovered
    items = append(items, doc)
  }
  // AddComma honors `format.trailingComma`: arrays accept trailing
  // commas in ES5 so both "all" and "es5" keep them; only "none"
  // suppresses. Hardcoding `true` would oscillate against Prettier on
  // every `none` project (the trailing-comma rule wouldn't insert one
  // and the printer would put one back).
  return printList(ctx, listShape{
    OpenTok:     "[",
    CloseTok:    "]",
    Items:       items,
    Space:       false,
    AddComma:    ctx.allowsEs5TrailingComma(),
    Fill:        isConciselyPrintedArray(arr.Elements.Nodes),
    ForceBreak:  arrayShouldForceBreak(arr.Elements.Nodes),
    BlankBefore: blankBeforeItems(ctx.Source, arr.Elements.Nodes),
  }), covered
}

// arrayShouldForceBreak reports whether an array literal takes Prettier's
// forced one-element-per-line layout even when it would fit flat: more than one
// element, every element an array or object literal carrying more than one
// child, and consecutive elements of the same kind (`[["(", ")"], ["{", "}"]]`
// and `new Map([[k, v], [k, v]])` break; a mixed `[[1, 2], { c: 3 }]` and a
// lone `[[1, 2]]` or single-child inners stay flat). Mirrors Prettier's array
// shouldBreak heuristic.
func arrayShouldForceBreak(elems []*shimast.Node) bool {
  if len(elems) < 2 {
    return false
  }
  for i, e := range elems {
    if !isMultiChildArrayOrObject(e) {
      return false
    }
    if i+1 < len(elems) && elems[i+1] != nil && elems[i+1].Kind != e.Kind {
      return false
    }
  }
  return true
}

// isMultiChildArrayOrObject reports whether `node` is an array or object literal
// with more than one element/property.
func isMultiChildArrayOrObject(node *shimast.Node) bool {
  if node == nil {
    return false
  }
  switch node.Kind {
  case shimast.KindArrayLiteralExpression:
    if a := node.AsArrayLiteralExpression(); a != nil && a.Elements != nil {
      return len(a.Elements.Nodes) > 1
    }
  case shimast.KindObjectLiteralExpression:
    if o := node.AsObjectLiteralExpression(); o != nil && o.Properties != nil {
      return len(o.Properties.Nodes) > 1
    }
  }
  return false
}

// arrayForcesBreak reports whether `node` is an array literal that Prettier's
// shouldBreak heuristic explodes regardless of width. The print-width rule
// consults it so its flat-fit fast path does not leave such an array inline
// when the source wrote it on one line.
func arrayForcesBreak(node *shimast.Node) bool {
  if node == nil || node.Kind != shimast.KindArrayLiteralExpression {
    return false
  }
  arr := node.AsArrayLiteralExpression()
  if arr == nil || arr.Elements == nil {
    return false
  }
  return arrayShouldForceBreak(arr.Elements.Nodes)
}

// isConciselyPrintedArray reports whether an array should use Prettier's
// concise "fill" layout: more than one element and every element a numeric
// literal (optionally a `+`/`-` signed numeric). Prettier packs such arrays
// several per line; mixed / string / identifier arrays stay one-per-line.
func isConciselyPrintedArray(elems []*shimast.Node) bool {
  if len(elems) < 2 {
    return false
  }
  for _, e := range elems {
    if !isNumericArrayElement(e) {
      return false
    }
  }
  return true
}

// isNumericArrayElement reports whether `node` is a numeric literal or a
// `+`/`-` prefix applied to one.
func isNumericArrayElement(node *shimast.Node) bool {
  if node == nil {
    return false
  }
  switch node.Kind {
  case shimast.KindNumericLiteral, shimast.KindBigIntLiteral:
    return true
  case shimast.KindPrefixUnaryExpression:
    u := node.AsPrefixUnaryExpression()
    if u == nil || u.Operand == nil {
      return false
    }
    if u.Operator != shimast.KindPlusToken && u.Operator != shimast.KindMinusToken {
      return false
    }
    return u.Operand.Kind == shimast.KindNumericLiteral ||
      u.Operand.Kind == shimast.KindBigIntLiteral
  }
  return false
}
