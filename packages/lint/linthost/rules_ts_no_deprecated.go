// typescript/no-deprecated: flag references to declarations annotated
// `@deprecated` in their JSDoc. The deprecation marker is the API
// owner's signal that a binding is on its way out; callers that keep
// reaching for it accumulate work to undo later, and the rule surfaces
// the dependency at the reference site. typescript-eslint:
// https://typescript-eslint.io/rules/no-deprecated/
//
// Type-aware. The rule visits the AST kinds that name a symbol —
// bare identifiers, property-access expressions, call / new
// expressions, and JSX opening / self-closing tag names — and asks the
// Checker for the symbol at the reference location. When any of the
// symbol's declarations carries a `@deprecated` JSDoc tag (attached
// either to the declaration itself or to its declaration block — e.g.
// JSDoc on a VariableStatement covers the inner VariableDeclaration),
// the rule reports at the reference with the deprecation comment when
// one is present.
//
// To avoid double-firing and silencing the deprecation site itself:
//
//   - identifiers at a declaration-name position (`function foo`,
//     `const foo`, `class Foo`, …) are skipped — they are the marker,
//     not a reference;
//   - the bare-identifier arm reports the canonical reference position
//     for property-access tails, JSX tag names, and call / new callees,
//     so the CallExpression, NewExpression, PropertyAccessExpression,
//     and JSX-element arms register only to keep the rule honest about
//     what it inspects — they don't report a second time.
package linthost

import (
	"strings"

	shimast "github.com/microsoft/typescript-go/shim/ast"
)

type noDeprecated struct{}

func (noDeprecated) Name() string { return "typescript/no-deprecated" }
func (noDeprecated) NeedsTypeChecker() bool {
	return true
}
func (noDeprecated) Visits() []shimast.Kind {
	return []shimast.Kind{
		shimast.KindIdentifier,
		shimast.KindPropertyAccessExpression,
		shimast.KindCallExpression,
		shimast.KindNewExpression,
		shimast.KindJsxOpeningElement,
		shimast.KindJsxSelfClosingElement,
	}
}
func (noDeprecated) Check(ctx *Context, node *shimast.Node) {
	if ctx.Checker == nil {
		return
	}
	// All non-identifier kinds delegate to the identifier walk for
	// reporting — they're listed in Visits() to keep the contract
	// explicit about which structural shapes carry symbol references,
	// but the actual diagnostic is emitted once per identifier so a
	// chain like `obj.method()` reports the `method` identifier, not
	// the surrounding PropertyAccess and CallExpression as well.
	if node.Kind != shimast.KindIdentifier {
		return
	}
	if noDeprecatedSkipIdentifier(node) {
		return
	}
	symbol := ctx.Checker.GetSymbolAtLocation(node)
	if symbol == nil {
		return
	}
	tag := findDeprecatedJSDocTag(symbol)
	if tag == nil {
		return
	}
	// Don't report when this identifier IS the name of one of the
	// symbol's declarations — that's the deprecation marker itself.
	if noDeprecatedLocationIsDeclarationName(node, symbol) {
		return
	}
	name := identifierText(node)
	if name == "" {
		name = symbol.Name
	}
	message := "`" + name + "` is deprecated."
	if comment := jsdocDeprecatedComment(tag); comment != "" {
		message = message + " " + comment
	}
	ctx.Report(node, message)
}

// noDeprecatedSkipIdentifier reports whether an identifier visit
// should be skipped. The skipped positions are:
//
//   - the LHS of a QualifiedName (`A.B` — only `B` resolves to the
//     referenced symbol).
//
// The general "is this identifier the declaration name?" gate is
// applied later against the resolved symbol's declarations — see
// `noDeprecatedLocationIsDeclarationName` — which handles every
// declaration kind without enumerating each one here.
func noDeprecatedSkipIdentifier(node *shimast.Node) bool {
	parent := node.Parent
	if parent == nil {
		return false
	}
	if parent.Kind == shimast.KindQualifiedName {
		qn := parent.AsQualifiedName()
		if qn != nil && qn.Left == node {
			return true
		}
	}
	return false
}

// noDeprecatedLocationIsDeclarationName reports whether `loc` is the
// name node of one of `symbol`'s declarations — i.e. the deprecation
// marker itself rather than a reference site.
func noDeprecatedLocationIsDeclarationName(loc *shimast.Node, symbol *shimast.Symbol) bool {
	if loc == nil || symbol == nil {
		return false
	}
	for _, decl := range symbol.Declarations {
		if decl == nil {
			continue
		}
		if decl.Name() == loc {
			return true
		}
	}
	return false
}

// findDeprecatedJSDocTag walks the symbol's declarations for a
// `@deprecated` JSDoc tag and returns the first one found. The walk
// climbs each declaration's ancestors up to the SourceFile because
// JSDoc on a VariableDeclaration is attached to the enclosing
// VariableStatement, and JSDoc on an ExportSpecifier may be on the
// outer ExportDeclaration.
func findDeprecatedJSDocTag(symbol *shimast.Symbol) *shimast.Node {
	if symbol == nil {
		return nil
	}
	for _, decl := range symbol.Declarations {
		if tag := deprecatedJSDocTagOnNodeOrAncestors(decl); tag != nil {
			return tag
		}
	}
	return nil
}

// deprecatedJSDocTagOnNodeOrAncestors walks up from `node` looking for
// a `@deprecated` JSDoc tag attached to any ancestor. Returns the
// first matching tag, or nil.
func deprecatedJSDocTagOnNodeOrAncestors(node *shimast.Node) *shimast.Node {
	for n := node; n != nil; n = n.Parent {
		for _, jsdoc := range n.JSDoc(nil) {
			data := jsdoc.AsJSDoc()
			if data == nil || data.Tags == nil {
				continue
			}
			for _, tag := range data.Tags.Nodes {
				if tag.Kind == shimast.KindJSDocDeprecatedTag {
					return tag
				}
			}
		}
		if n.Kind == shimast.KindSourceFile {
			return nil
		}
	}
	return nil
}

// jsdocDeprecatedComment returns the textual comment that follows the
// `@deprecated` token in `tag`'s source range, trimmed of surrounding
// whitespace. Empty when the tag has no comment.
func jsdocDeprecatedComment(tag *shimast.Node) string {
	if tag == nil {
		return ""
	}
	src := strings.TrimSpace(shimast.NodeText(tag))
	if src == "" {
		return ""
	}
	const prefix = "@deprecated"
	if strings.HasPrefix(src, prefix) {
		src = src[len(prefix):]
	}
	return strings.TrimSpace(src)
}

func init() {
	Register(noDeprecated{})
}
