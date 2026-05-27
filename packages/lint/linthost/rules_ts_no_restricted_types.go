// AST-only baseline of typescript-eslint's `no-restricted-types`.
//
// The upstream rule is fully configurable — users supply a map from
// banned type name to a custom message and (optionally) a rewrite hint.
// Without the rule-options plumbing, this baseline ships a fixed
// default set that covers the five built-in wrapper / global types
// that almost every team forbids: `Object`, `Function`, `Number`,
// `String`, and `Boolean`. The dedicated `typescript/no-unsafe-function-type`
// and `typescript/no-wrapper-object-types` rules also cover some of
// these, but `no-restricted-types` is the documented umbrella users
// reach for when they want a single "ban these names" knob.
//
// https://typescript-eslint.io/rules/no-restricted-types/
package linthost

import (
	shimast "github.com/microsoft/typescript-go/shim/ast"
)

type noRestrictedTypes struct{}

// noRestrictedTypesDefault is the default set surfaced by the rule
// when no config is supplied. Each entry pairs the banned identifier
// with a short, actionable replacement hint.
var noRestrictedTypesDefault = map[string]string{
	"Object":   "Use `object` (any non-primitive) or a specific shape like `Record<string, unknown>` instead of `Object`.",
	"Function": "Declare the specific call signature instead of the unsafe `Function` type.",
	"Number":   "Use the lowercase primitive `number` instead of the wrapper type `Number`.",
	"String":   "Use the lowercase primitive `string` instead of the wrapper type `String`.",
	"Boolean":  "Use the lowercase primitive `boolean` instead of the wrapper type `Boolean`.",
}

func (noRestrictedTypes) Name() string { return "typescript/no-restricted-types" }
func (noRestrictedTypes) Visits() []shimast.Kind {
	return []shimast.Kind{shimast.KindTypeReference}
}
func (noRestrictedTypes) Check(ctx *Context, node *shimast.Node) {
	ref := node.AsTypeReferenceNode()
	if ref == nil || ref.TypeName == nil {
		return
	}
	name := identifierText(ref.TypeName)
	if name == "" {
		return
	}
	message, banned := noRestrictedTypesDefault[name]
	if !banned {
		return
	}
	// Shadow guard: if the user has declared a same-named `type` /
	// `interface` / `class` at file scope, their identifier is NOT the
	// global wrapper. Re-use the wrapper-types helper so the two rules
	// stay consistent about what counts as a shadow.
	if fileShadowsWrapperName(ctx.File, name) {
		return
	}
	ctx.Report(node, message)
}

func init() {
	Register(noRestrictedTypes{})
}
