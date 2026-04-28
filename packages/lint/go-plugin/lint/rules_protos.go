package lint

import shimast "github.com/microsoft/typescript-go/shim/ast"

// no-iterator: `obj.__iterator__` is a non-standard SpiderMonkey-era
// access. Use `Symbol.iterator` instead.
// https://eslint.org/docs/latest/rules/no-iterator
type noIterator struct{}

func (noIterator) Name() string             { return "no-iterator" }
func (noIterator) Visits() []shimast.Kind   { return []shimast.Kind{shimast.KindPropertyAccessExpression} }
func (noIterator) Check(ctx *Context, node *shimast.Node) {
	access := node.AsPropertyAccessExpression()
	if access == nil {
		return
	}
	if identifierText(access.Name()) == "__iterator__" {
		ctx.Report(node, "Reserved name '__iterator__'.")
	}
}

// no-proto: `obj.__proto__` access is legacy. Use `Object.getPrototypeOf`
// / `Object.setPrototypeOf`.
// https://eslint.org/docs/latest/rules/no-proto
type noProto struct{}

func (noProto) Name() string             { return "no-proto" }
func (noProto) Visits() []shimast.Kind   { return []shimast.Kind{shimast.KindPropertyAccessExpression} }
func (noProto) Check(ctx *Context, node *shimast.Node) {
	access := node.AsPropertyAccessExpression()
	if access == nil {
		return
	}
	if identifierText(access.Name()) == "__proto__" {
		ctx.Report(node, "The '__proto__' property is deprecated.")
	}
}

func init() {
	Register(noIterator{})
	Register(noProto{})
}
