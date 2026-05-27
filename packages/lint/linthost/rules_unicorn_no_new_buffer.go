// unicorn/no-new-buffer: the `new Buffer(...)` constructor was deprecated
// in Node because its overloads route on argument type at runtime — an
// integer allocates uninitialized memory, a string decodes bytes, an array
// copies them — so the same call site silently changes meaning when its
// input shape changes. The replacement is the explicit `Buffer.from()` /
// `Buffer.alloc()` pair.
//
// AST-only and identifier-text-driven: the rule fires on any `NewExpression`
// whose callee is an `Identifier` named `Buffer`. Shadowed `Buffer`
// bindings and import sources are out of scope; argument count and shape
// are not part of the match, so `new Buffer(10)`, `new Buffer("ascii")`,
// and `new Buffer([])` all report.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-new-buffer.md
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

type unicornNoNewBuffer struct{}

func (unicornNoNewBuffer) Name() string           { return "unicorn/no-new-buffer" }
func (unicornNoNewBuffer) Visits() []shimast.Kind { return []shimast.Kind{shimast.KindNewExpression} }
func (unicornNoNewBuffer) Check(ctx *Context, node *shimast.Node) {
	ne := node.AsNewExpression()
	if ne != nil && identifierText(ne.Expression) == "Buffer" {
		ctx.Report(node, "`new Buffer()` is deprecated, use `Buffer.from()` or `Buffer.alloc()` instead.")
	}
}

func init() {
	Register(unicornNoNewBuffer{})
}
