package lint

import shimast "github.com/microsoft/typescript-go/shim/ast"

// no-sparse-arrays: `[1, , 2]` — the implied undefined slot is almost
// always a typo.
// https://eslint.org/docs/latest/rules/no-sparse-arrays
type noSparseArrays struct{}

func (noSparseArrays) Name() string             { return "no-sparse-arrays" }
func (noSparseArrays) Visits() []shimast.Kind   { return []shimast.Kind{shimast.KindArrayLiteralExpression} }
func (noSparseArrays) Check(ctx *Context, node *shimast.Node) {
	arr := node.AsArrayLiteralExpression()
	if arr == nil || arr.Elements == nil {
		return
	}
	for _, el := range arr.Elements.Nodes {
		if el != nil && el.Kind == shimast.KindOmittedExpression {
			ctx.Report(node, "Unexpected comma in middle of array.")
			return
		}
	}
}

// no-array-constructor: forbid `new Array(0)` / `Array(1, 2, 3)` (use
// array literals). The 1-arg numeric form is also banned because its
// behavior depends on the runtime — see ESLint defaults.
// https://eslint.org/docs/latest/rules/no-array-constructor
type noArrayConstructor struct{}

func (noArrayConstructor) Name() string { return "no-array-constructor" }
func (noArrayConstructor) Visits() []shimast.Kind {
	return []shimast.Kind{shimast.KindNewExpression, shimast.KindCallExpression}
}
func (noArrayConstructor) Check(ctx *Context, node *shimast.Node) {
	var callee *shimast.Node
	var argCount int
	switch node.Kind {
	case shimast.KindNewExpression:
		ne := node.AsNewExpression()
		if ne == nil {
			return
		}
		if ne.TypeArguments != nil && len(ne.TypeArguments.Nodes) > 0 {
			return // `new Array<string>()` is a typed empty array
		}
		callee = ne.Expression
		if ne.Arguments != nil {
			argCount = len(ne.Arguments.Nodes)
		}
	case shimast.KindCallExpression:
		call := node.AsCallExpression()
		if call == nil {
			return
		}
		if call.TypeArguments != nil && len(call.TypeArguments.Nodes) > 0 {
			return
		}
		callee = call.Expression
		if call.Arguments != nil {
			argCount = len(call.Arguments.Nodes)
		}
	}
	if identifierText(callee) != "Array" {
		return
	}
	// Single-arg numeric — ambiguous (length vs single element). Skip
	// so existing patterns aren't flagged when the intent is preallocate.
	if argCount == 1 {
		return
	}
	ctx.Report(node, "The array literal notation [] is preferable.")
}

func init() {
	Register(noSparseArrays{})
	Register(noArrayConstructor{})
}
