// AST-only baseline of typescript-eslint's `no-redundant-type-constituents`.
//
// The rule reports type union/intersection constituents that the type
// system would absorb — `string | any` collapses to `any`, `T & never`
// collapses to `never`, `T & unknown` collapses to `T`, and repeated
// constituents add nothing.
//
// Without the Checker the rule can only see what the type node declares,
// so the baseline covers the cases where one operand is the literal
// `any` / `unknown` / `never` keyword, plus duplicate operands matched
// by textual identity. Subset relations such as `string | "foo"` and
// generic alias resolution still need the type-aware path.
// https://typescript-eslint.io/rules/no-redundant-type-constituents/
package linthost

import (
	"strings"

	shimast "github.com/microsoft/typescript-go/shim/ast"
)

type noRedundantTypeConstituents struct{}

func (noRedundantTypeConstituents) Name() string {
	return "typescript/no-redundant-type-constituents"
}
func (noRedundantTypeConstituents) Visits() []shimast.Kind {
	return []shimast.Kind{shimast.KindUnionType, shimast.KindIntersectionType}
}
func (noRedundantTypeConstituents) Check(ctx *Context, node *shimast.Node) {
	types := unionOrIntersectionTypes(node)
	if len(types) < 2 {
		return
	}
	isUnion := node.Kind == shimast.KindUnionType
	hasAny := containsKeywordType(types, shimast.KindAnyKeyword)
	hasUnknown := containsKeywordType(types, shimast.KindUnknownKeyword)
	hasNever := containsKeywordType(types, shimast.KindNeverKeyword)
	label := "intersection"
	if isUnion {
		label = "union"
	}
	seen := map[string]bool{}
	for _, t := range types {
		if t == nil {
			continue
		}
		switch {
		case isUnion && (hasAny || hasUnknown) && t.Kind != shimast.KindAnyKeyword && t.Kind != shimast.KindUnknownKeyword:
			// `T | any` / `T | unknown` — every non-top constituent is
			// absorbed. `any` takes precedence in the message because
			// `any` also subsumes `unknown`.
			absorbing := "unknown"
			if hasAny {
				absorbing = "any"
			}
			ctx.Report(t, "Constituent is overridden by `"+absorbing+"` in the surrounding union.")
		case isUnion && hasNever && t.Kind == shimast.KindNeverKeyword:
			ctx.Report(t, "`never` is absorbed by the surrounding union.")
		case !isUnion && hasNever:
			// `T & never` collapses to `never` for every constituent.
			ctx.Report(t, "Intersection with `never` collapses to `never`.")
		case !isUnion && hasUnknown && t.Kind == shimast.KindUnknownKeyword:
			ctx.Report(t, "`unknown` is absorbed by the surrounding intersection.")
		}
		// Duplicate by textual identity — fire on the second occurrence
		// so the first declaration stays unblamed.
		key := strings.TrimSpace(nodeText(ctx.File, t))
		if key == "" {
			continue
		}
		if seen[key] {
			ctx.Report(t, "Duplicate constituent in "+label+".")
			continue
		}
		seen[key] = true
	}
}

// unionOrIntersectionTypes returns the constituent type nodes of a union
// or intersection type node, or nil for other shapes.
func unionOrIntersectionTypes(node *shimast.Node) []*shimast.Node {
	if node == nil {
		return nil
	}
	switch node.Kind {
	case shimast.KindUnionType:
		if u := node.AsUnionTypeNode(); u != nil && u.Types != nil {
			return u.Types.Nodes
		}
	case shimast.KindIntersectionType:
		if i := node.AsIntersectionTypeNode(); i != nil && i.Types != nil {
			return i.Types.Nodes
		}
	}
	return nil
}

// containsKeywordType reports whether `types` contains a direct keyword
// type node of `kind` — `any`, `unknown`, or `never` in type position
// parse as bare keyword nodes rather than identifiers.
func containsKeywordType(types []*shimast.Node, kind shimast.Kind) bool {
	for _, t := range types {
		if t != nil && t.Kind == kind {
			return true
		}
	}
	return false
}

func init() {
	Register(noRedundantTypeConstituents{})
}
