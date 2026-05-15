package main

import (
  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// printObjectLiteral renders an ObjectLiteralExpression with width-aware
// fit-or-break. Members are emitted verbatim from the source — only
// the outer braces and the comma layout participate in reflow. That
// keeps the per-member behavior compatible with shapes the dispatcher
// has not yet learned (computed property keys, accessor declarations,
// spread elements, etc.), while still solving the headline use case:
// long member lists that need to break across lines.
//
// Flat:    `{ a: 1, b: 2 }`
//
//  Broken:  `{
//              a: 1,
//              b: 2,
//           }`
//
// The flat form uses a single space inside the braces, matching
// Prettier's `bracketSpacing: true` default. Empty object literals
// collapse to `{}` with no inner space, matching every formatter.
func printObjectLiteral(ctx *PrintContext, node *shimast.Node) Doc {
  if node == nil {
    return Doc{}
  }
  obj := node.AsObjectLiteralExpression()
  if obj == nil || obj.Properties == nil {
    return verbatim(ctx, node)
  }
  items := make([]Doc, 0, len(obj.Properties.Nodes))
  for _, prop := range obj.Properties.Nodes {
    if prop == nil {
      // A nil child entry would render as an empty Doc and surface
      // as `a, , b` in the output. Bail to verbatim so the source
      // bytes round-trip unchanged.
      return verbatim(ctx, node)
    }
    doc, _ := PrintNode(ctx, prop)
    items = append(items, doc)
  }
  return printList(ctx, listShape{
    OpenTok:  "{",
    CloseTok: "}",
    Items:    items,
    Space:    true,
    AddComma: true,
  })
}
