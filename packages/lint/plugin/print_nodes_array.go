package main

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
func printArrayLiteral(ctx *PrintContext, node *shimast.Node) Doc {
  if node == nil {
    return Doc{}
  }
  arr := node.AsArrayLiteralExpression()
  if arr == nil || arr.Elements == nil {
    return verbatim(ctx, node)
  }
  items := make([]Doc, 0, len(arr.Elements.Nodes))
  for _, elem := range arr.Elements.Nodes {
    if elem == nil {
      return verbatim(ctx, node)
    }
    doc, _ := PrintNode(ctx, elem)
    items = append(items, doc)
  }
  return printList(ctx, listShape{
    OpenTok:  "[",
    CloseTok: "]",
    Items:    items,
    Space:    false,
    AddComma: true,
  })
}
