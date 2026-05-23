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
    OpenTok:  "[",
    CloseTok: "]",
    Items:    items,
    Space:    false,
    AddComma: ctx.allowsEs5TrailingComma(),
  }), covered
}
