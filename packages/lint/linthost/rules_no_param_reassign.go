// noParamReassign: reassigning a function parameter inside the body of
// the function it belongs to. Mutating the binding makes the declared
// name stop pointing at the caller's argument and is the usual ESLint
// baseline of `no-param-reassign` — without the `props: true` extension
// that would also flag `param.foo = …`.
//
// Conservative scope tracking: collect simple-identifier parameter
// names, walk the body until a nested function-like introduces a fresh
// scope, and flag `name = …` / `name op= …` / `++name` / `name--` at
// any depth in between. A local `const name = 1` that shadows a
// parameter name will produce a false positive in v1 — proper scope
// tracking needs the resolver, which the AST-only baseline avoids.
// Destructured parameter bindings are skipped for the same reason.
// https://eslint.org/docs/latest/rules/no-param-reassign
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

type noParamReassign struct{}

func (noParamReassign) Name() string { return "no-param-reassign" }
func (noParamReassign) Visits() []shimast.Kind {
	return []shimast.Kind{
		shimast.KindFunctionDeclaration,
		shimast.KindFunctionExpression,
		shimast.KindArrowFunction,
		shimast.KindMethodDeclaration,
		shimast.KindConstructor,
		shimast.KindGetAccessor,
		shimast.KindSetAccessor,
	}
}
func (noParamReassign) Check(ctx *Context, node *shimast.Node) {
	body := node.Body()
	if body == nil {
		return
	}
	names := map[string]bool{}
	for _, p := range node.Parameters() {
		if decl := p.AsParameterDeclaration(); decl != nil {
			if name := identifierText(decl.Name()); name != "" {
				names[name] = true
			}
		}
	}
	if len(names) == 0 {
		return
	}
	walkParamReassignBody(body, names, func(target *shimast.Node) {
		ctx.Report(target, "Assignment to function parameter.")
	})
}

// walkParamReassignBody visits every assignment-like write in `root`
// without crossing nested function-like scopes. The target identifier
// must be a bare name in `names` for `report` to fire.
func walkParamReassignBody(root *shimast.Node, names map[string]bool, report func(*shimast.Node)) {
	if root == nil {
		return
	}
	var walk func(*shimast.Node)
	hits := func(operand *shimast.Node) bool {
		name := identifierText(stripParens(operand))
		return name != "" && names[name]
	}
	walk = func(node *shimast.Node) {
		if node == nil || (node != root && isFunctionLikeKind(node)) {
			return
		}
		switch node.Kind {
		case shimast.KindBinaryExpression:
			expr := node.AsBinaryExpression()
			if expr != nil && expr.OperatorToken != nil &&
				isAssignmentOperator(expr.OperatorToken.Kind) && hits(expr.Left) {
				report(node)
			}
		case shimast.KindPrefixUnaryExpression:
			pre := node.AsPrefixUnaryExpression()
			if pre != nil && (pre.Operator == shimast.KindPlusPlusToken || pre.Operator == shimast.KindMinusMinusToken) && hits(pre.Operand) {
				report(node)
			}
		case shimast.KindPostfixUnaryExpression:
			post := node.AsPostfixUnaryExpression()
			if post != nil && (post.Operator == shimast.KindPlusPlusToken || post.Operator == shimast.KindMinusMinusToken) && hits(post.Operand) {
				report(node)
			}
		}
		node.ForEachChild(func(child *shimast.Node) bool {
			walk(child)
			return false
		})
	}
	walk(root)
}

func init() {
	Register(noParamReassign{})
}
