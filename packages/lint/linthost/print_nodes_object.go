package linthost

import (
  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimscanner "github.com/microsoft/typescript-go/shim/scanner"
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
//
// The second return value is the `covered` flag: see PrintNode. It is
// the AND of every property's coverage — one multi-line verbatim
// member taints the whole literal.
func printObjectLiteral(ctx *PrintContext, node *shimast.Node) (Doc, bool) {
  if node == nil {
    return Doc{}, true
  }
  obj := node.AsObjectLiteralExpression()
  if obj == nil || obj.Properties == nil {
    return verbatim(ctx, node), !nodeSpansMultipleLines(ctx, node)
  }
  // A comment between properties (or after `{`) would be dropped by the fresh
  // separators; bail to verbatim and report UNCOVERED (hard `false`, not
  // `!nodeSpansMultipleLines`) so an enclosing reflow abstains instead of
  // breaking around this single-line verbatim object and moving it off its line.
  if listHasInterItemComments(ctx, node) {
    return verbatim(ctx, node), false
  }
  items := make([]Doc, 0, len(obj.Properties.Nodes))
  covered := true
  for _, prop := range obj.Properties.Nodes {
    if prop == nil {
      // A nil child entry would render as an empty Doc and surface
      // as `a, , b` in the output. Bail to verbatim so the source
      // bytes round-trip unchanged.
      return verbatim(ctx, node), !nodeSpansMultipleLines(ctx, node)
    }
    doc, childCovered := PrintNode(ctx, prop)
    covered = covered && childCovered
    items = append(items, doc)
  }
  // objectWrap:"preserve" — keep a non-empty object expanded when the
  // source wrote a newline after `{`. An empty literal has no first
  // property to anchor the check and never preserves.
  forceBreak := false
  if len(obj.Properties.Nodes) > 0 {
    forceBreak = objectHasNewlineAfterBrace(ctx.Source, node, obj.Properties.Nodes[0])
  }
  // AddComma honors `format.trailingComma`: object literals accept
  // trailing commas in ES5 so both "all" and "es5" keep them; only
  // "none" suppresses. Pairs with the call/array branches so the printer
  // never disagrees with the trailing-comma rule on the same setting.
  //
  // A destructuring assignment target ending in a rest
  // (`({ a, ...rest } = obj)`) is the one exception: a trailing comma
  // after its `AssignmentRestProperty` is a syntax error, so the reflow
  // must not emit one even under "all"/"es5". Matches the same suppression
  // in `format/trailing-comma`; see isRestAssignmentTargetLiteral.
  return printList(ctx, listShape{
    OpenTok:     "{",
    CloseTok:    "}",
    Items:       items,
    Space:       true,
    AddComma:    ctx.allowsEs5TrailingComma() && !isRestAssignmentTargetLiteral(node),
    ForceBreak:  forceBreak,
    BlankBefore: blankBeforeItems(ctx.Source, obj.Properties.Nodes),
  }), covered
}

// objectHasNewlineAfterBrace reports whether the source places a
// newline between the object literal's `{` and its first property.
//
// Prettier's objectWrap:"preserve" default keeps such an object
// expanded even when it would fit flat, treating the author's line
// break as intentional structure. formatPrintWidth mirrors that:
// without it a deliberately multi-line object that happens to fit
// would be silently collapsed onto one line, which Prettier never
// does.
func objectHasNewlineAfterBrace(src string, node *shimast.Node, firstProp *shimast.Node) bool {
  if node == nil || firstProp == nil {
    return false
  }
  brace := shimscanner.SkipTrivia(src, node.Pos())
  propStart := shimscanner.SkipTrivia(src, firstProp.Pos())
  if brace < 0 || propStart <= brace || propStart > len(src) {
    return false
  }
  for i := brace; i < propStart; i++ {
    if src[i] == '\n' {
      return true
    }
  }
  return false
}
