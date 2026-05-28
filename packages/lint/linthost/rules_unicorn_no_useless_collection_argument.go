// unicorn/no-useless-collection-argument: `new Set()`, `new Map()`,
// `new WeakSet()`, and `new WeakMap()` already start empty. Passing an
// explicit `null`, `undefined`, or `[]` reads as if the author meant to
// seed the collection with entries but came up empty — it adds noise
// without changing behavior. Zero-argument calls are the canonical
// correct form and are NOT flagged.
//
// AST-only and identifier-text-driven: visit every `NewExpression`
// whose callee identifier is one of the four collection constructors,
// then match a single argument that is a `null`/`undefined` literal,
// an `undefined` identifier, or an empty array literal. The receiver
// chain is not inspected; shadowed `Set`/`Map` bindings are out of
// scope, mirroring the other constructor-name-only unicorn rules.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-useless-collection-argument.md
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

type unicornNoUselessCollectionArgument struct{}

func (unicornNoUselessCollectionArgument) Name() string {
	return "unicorn/no-useless-collection-argument"
}
func (unicornNoUselessCollectionArgument) Visits() []shimast.Kind {
	return []shimast.Kind{shimast.KindNewExpression}
}
func (unicornNoUselessCollectionArgument) Check(ctx *Context, node *shimast.Node) {
	ne := node.AsNewExpression()
	if ne == nil {
		return
	}
	switch identifierText(ne.Expression) {
	case "Set", "Map", "WeakSet", "WeakMap":
	default:
		return
	}
	if ne.Arguments == nil || len(ne.Arguments.Nodes) != 1 {
		return
	}
	arg := stripParens(ne.Arguments.Nodes[0])
	if arg == nil {
		return
	}
	switch arg.Kind {
	case shimast.KindNullKeyword, shimast.KindUndefinedKeyword:
		ctx.Report(node, "Don't pass a useless initializer to `new <Collection>()`.")
		return
	case shimast.KindIdentifier:
		if identifierText(arg) == "undefined" {
			ctx.Report(node, "Don't pass a useless initializer to `new <Collection>()`.")
		}
		return
	case shimast.KindArrayLiteralExpression:
		if arr := arg.AsArrayLiteralExpression(); arr != nil &&
			(arr.Elements == nil || len(arr.Elements.Nodes) == 0) {
			ctx.Report(node, "Don't pass a useless initializer to `new <Collection>()`.")
		}
	}
}

func init() {
	Register(unicornNoUselessCollectionArgument{})
}
