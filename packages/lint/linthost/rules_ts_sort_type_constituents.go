// typescript/sort-type-constituents: union and intersection type
// constituents render the same set of values regardless of the order
// the author chose, so two authors writing the same type can disagree
// on the spelling. The rule pins one canonical ordering — primitives
// alphabetized first, then named / object types alphabetized, then
// `null` / `undefined` last — so reviewers don't have to argue about
// which spelling to land. typescript-eslint:
// https://typescript-eslint.io/rules/sort-type-constituents/
package linthost

import (
  "sort"
  "strings"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// sortTypeConstituents fires on `UnionType` and `IntersectionType` when
// the constituent order does not match the canonical ordering. The
// check is AST-only: ordering is decided by syntactic group (keyword
// primitive vs. named reference vs. nullish) and a within-group source
// sort, none of which need the Checker.
//
// The diagnostic anchors to the union / intersection node so the
// rendered location names the whole type, not just one constituent.
// One report per misordered type is enough — the autofixer would
// rewrite the entire list together anyway.
type sortTypeConstituents struct{}

func (sortTypeConstituents) Name() string {
  return "typescript/sort-type-constituents"
}
func (sortTypeConstituents) Visits() []shimast.Kind {
  return []shimast.Kind{
    shimast.KindUnionType,
    shimast.KindIntersectionType,
  }
}
func (sortTypeConstituents) Check(ctx *Context, node *shimast.Node) {
  types := unionOrIntersectionTypes(node)
  if len(types) < 2 {
    return
  }
  // Skip nested unions/intersections — the outermost shape is the one
  // the user wrote, and reporting on every nesting level would
  // double-fire on `(A | B) | C` shapes.
  if node.Parent != nil &&
    (node.Parent.Kind == shimast.KindUnionType || node.Parent.Kind == shimast.KindIntersectionType) {
    return
  }
  entries := make([]sortTypeConstituentsEntry, len(types))
  for i, t := range types {
    entries[i] = sortTypeConstituentsEntry{
      index: i,
      group: sortTypeConstituentsClassify(t),
      text:  strings.TrimSpace(nodeText(ctx.File, t)),
    }
  }
  sorted := make([]sortTypeConstituentsEntry, len(entries))
  copy(sorted, entries)
  sort.SliceStable(sorted, func(i, j int) bool {
    if sorted[i].group != sorted[j].group {
      return sorted[i].group < sorted[j].group
    }
    return sorted[i].text < sorted[j].text
  })
  for i := range entries {
    if entries[i].index != sorted[i].index {
      label := "union"
      if node.Kind == shimast.KindIntersectionType {
        label = "intersection"
      }
      ctx.Report(node, "Constituents of the "+label+" are not in the canonical order — primitives alphabetized first, named types alphabetized next, `null` / `undefined` last.")
      return
    }
  }
}

// sortTypeConstituentsEntry is one constituent's sort key. `index`
// records the original position so the reorder check can compare the
// before/after sequences without losing identity.
type sortTypeConstituentsEntry struct {
  index int
  group int
  text  string
}

// sortTypeConstituentsClassify buckets a constituent into one of the
// canonical groups. Smaller numbers come first in the canonical order.
func sortTypeConstituentsClassify(node *shimast.Node) int {
  if node == nil {
    return sortTypeConstituentsGroupNamed
  }
  switch node.Kind {
  case shimast.KindStringKeyword,
    shimast.KindNumberKeyword,
    shimast.KindBooleanKeyword,
    shimast.KindBigIntKeyword,
    shimast.KindSymbolKeyword,
    shimast.KindAnyKeyword,
    shimast.KindUnknownKeyword,
    shimast.KindVoidKeyword,
    shimast.KindNeverKeyword,
    shimast.KindObjectKeyword:
    return sortTypeConstituentsGroupPrimitive
  case shimast.KindLiteralType:
    // `null` and `undefined` parse as LiteralType / undefined
    // keyword inside type position — surface them as the nullish
    // group so the canonical order keeps them at the end.
    if sortTypeConstituentsIsNullish(node) {
      return sortTypeConstituentsGroupNullish
    }
    return sortTypeConstituentsGroupLiteral
  case shimast.KindUndefinedKeyword, shimast.KindNullKeyword:
    return sortTypeConstituentsGroupNullish
  }
  return sortTypeConstituentsGroupNamed
}

const (
  sortTypeConstituentsGroupPrimitive = iota
  sortTypeConstituentsGroupLiteral
  sortTypeConstituentsGroupNamed
  sortTypeConstituentsGroupNullish
)

// sortTypeConstituentsIsNullish reports whether a LiteralType node
// wraps the `null` keyword token. The `undefined` keyword in type
// position is a regular Identifier-shaped reference and is handled by
// the named group, not by this helper.
func sortTypeConstituentsIsNullish(node *shimast.Node) bool {
  if node == nil || node.Kind != shimast.KindLiteralType {
    return false
  }
  lit := node.AsLiteralTypeNode()
  if lit == nil || lit.Literal == nil {
    return false
  }
  return lit.Literal.Kind == shimast.KindNullKeyword
}

func init() {
  Register(sortTypeConstituents{})
}
