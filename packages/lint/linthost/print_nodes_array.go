package linthost

import (
  "strings"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimscanner "github.com/microsoft/typescript-go/shim/scanner"
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
  // separators; bail to verbatim and report UNCOVERED (hard `false`, not
  // `!nodeSpansMultipleLines`) so an enclosing reflow abstains instead of
  // breaking around this single-line verbatim array and moving it off its line.
  if listHasInterItemComments(ctx, node) {
    return verbatim(ctx, node), false
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
  //
  // A destructuring assignment target ending in a rest
  // (`[a, ...rest] = arr`) is the one exception: a trailing comma after
  // its `AssignmentRestElement` is a syntax error, so the reflow must not
  // emit one even under "all"/"es5". Matches the same suppression in
  // `format/trailing-comma`; see isRestAssignmentTargetLiteral.
  return printList(ctx, listShape{
    OpenTok:     "[",
    CloseTok:    "]",
    Items:       items,
    Space:       false,
    AddComma:    ctx.allowsEs5TrailingComma() && !isRestAssignmentTargetLiteral(node),
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

// fastPathForcesBreak reports whether `node`, OR a force-breaking node nested
// within the subtree a reflow of `node` would print (its call/new arguments and
// array elements, recursively), must explode even though it fits flat. Prettier
// breaks such a descendant — an array `shouldBreak` or a function-composition
// call/new — when the enclosing node reflows; ttsc's print-width fast path
// returns first while the descendant abstains via hasReflowAncestor, leaving
// both flat (`new Map([["a", 1], ["b", 2]])`, `foo([[1, 2], [3, 4]])`). So the
// fast path must consult this, not only the visited node itself.
func fastPathForcesBreak(node *shimast.Node, src string) bool {
  if node == nil {
    return false
  }
  if callForcesFunctionBreak(node) || arrayForcesBreak(node) || blockForcesBreak(node, src) {
    return true
  }
  var children []*shimast.Node
  switch node.Kind {
  case shimast.KindCallExpression:
    if c := node.AsCallExpression(); c != nil && c.Arguments != nil {
      children = c.Arguments.Nodes
    }
  case shimast.KindNewExpression:
    if n := node.AsNewExpression(); n != nil && n.Arguments != nil {
      children = n.Arguments.Nodes
    }
  case shimast.KindArrayLiteralExpression:
    if a := node.AsArrayLiteralExpression(); a != nil && a.Elements != nil {
      children = a.Elements.Nodes
    }
  case shimast.KindArrowFunction, shimast.KindFunctionExpression:
    children = append(children, functionLikeBody(node))
  case shimast.KindConditionalExpression:
    if conditional := node.AsConditionalExpression(); conditional != nil {
      children = append(children, conditional.Condition, conditional.WhenTrue, conditional.WhenFalse)
    }
  case shimast.KindObjectLiteralExpression:
    // A force-breaking array/object nested in an object PROPERTY value
    // (`{ m: [[1, 2], [3, 4]] }`) must also deny the fast path: the value
    // abstains to its object ancestor via hasReflowAncestor, and the object
    // itself fits flat, so without descending into property initializers both
    // would stay flat where Prettier breaks them.
    if o := node.AsObjectLiteralExpression(); o != nil && o.Properties != nil {
      for _, p := range o.Properties.Nodes {
        if p == nil {
          continue
        }
        switch p.Kind {
        case shimast.KindPropertyAssignment,
          shimast.KindMethodDeclaration,
          shimast.KindGetAccessor,
          shimast.KindSetAccessor:
          children = append(children, functionLikeBody(p))
        }
      }
    }
  }
  for _, ch := range children {
    if fastPathForcesBreak(ch, src) {
      return true
    }
  }
  return false
}

// blockForcesBreak reports whether `node` is a block Prettier expands even
// when it fits: one carrying a statement or a comment. Whitespace-only `{}` is
// the empty negative twin and remains flat.
func blockForcesBreak(node *shimast.Node, src string) bool {
  if node == nil || node.Kind != shimast.KindBlock {
    return false
  }
  block := node.AsBlock()
  if block == nil || block.Statements == nil {
    return false
  }
  if len(block.Statements.Nodes) > 0 {
    return true
  }
  start := shimscanner.SkipTrivia(src, node.Pos())
  end := node.End()
  return start >= 0 && end > start+1 && end <= len(src) &&
    src[start] == '{' && src[end-1] == '}' &&
    strings.TrimSpace(src[start+1:end-1]) != ""
}

// functionLikeBody returns the part of an arrow, function expression, or
// object member that an enclosing reflow prints structurally.
func functionLikeBody(node *shimast.Node) *shimast.Node {
  if node == nil {
    return nil
  }
  switch node.Kind {
  case shimast.KindArrowFunction:
    if arrow := node.AsArrowFunction(); arrow != nil {
      return arrow.Body
    }
  case shimast.KindFunctionExpression:
    if function := node.AsFunctionExpression(); function != nil {
      return function.Body
    }
  case shimast.KindPropertyAssignment:
    if property := node.AsPropertyAssignment(); property != nil {
      return property.Initializer
    }
  case shimast.KindMethodDeclaration:
    if method := node.AsMethodDeclaration(); method != nil {
      return method.Body
    }
  case shimast.KindGetAccessor:
    if accessor := node.AsGetAccessorDeclaration(); accessor != nil {
      return accessor.Body
    }
  case shimast.KindSetAccessor:
    if accessor := node.AsSetAccessorDeclaration(); accessor != nil {
      return accessor.Body
    }
  }
  return nil
}

// isConciselyPrintedArray reports whether an array should use Prettier's
// concise "fill" layout: at least one element and every element a numeric
// literal (optionally a `+`/`-` signed numeric). Prettier packs such arrays
// several per line; mixed / string / identifier arrays stay one-per-line.
// Prettier's predicate gates on `elements.length > 0` (array.js), so a
// single-element numeric array counts — which also makes a `[42]` last
// argument decline last-argument hugging, matching shouldExpandLastArg.
func isConciselyPrintedArray(elems []*shimast.Node) bool {
  if len(elems) < 1 {
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
// `+`/`-` prefix applied to one. A BigInt literal is NOT numeric here: Prettier's
// isNumericLiteral matches only a number-valued literal, so `[1n, 2n]` prints
// one element per line rather than filling.
func isNumericArrayElement(node *shimast.Node) bool {
  if node == nil {
    return false
  }
  switch node.Kind {
  case shimast.KindNumericLiteral:
    return true
  case shimast.KindPrefixUnaryExpression:
    u := node.AsPrefixUnaryExpression()
    if u == nil || u.Operand == nil {
      return false
    }
    if u.Operator != shimast.KindPlusToken && u.Operator != shimast.KindMinusToken {
      return false
    }
    return u.Operand.Kind == shimast.KindNumericLiteral
  }
  return false
}
