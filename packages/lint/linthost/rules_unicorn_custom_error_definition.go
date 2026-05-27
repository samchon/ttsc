// unicorn/custom-error-definition: a class that extends a built-in
// `Error` constructor inherits the `message` and `stack` plumbing but
// not a sensible `name`. The canonical custom-error shape calls
// `super(message)` so the inherited fields are initialized AND sets
// `this.name` to the subclass identifier so engines and loggers can
// distinguish it from generic `Error` instances.
//
// AST-only: visit each `ClassDeclaration` / `ClassExpression`. Match
// the `extends <Identifier>` clause against the eight built-in Error
// constructors. When a constructor exists, fire if its body contains
// no `super(...)` call — the conservative MVP. Anything subtler (does
// the super call forward `message`? is `this.name` ever assigned?) is
// out of scope for the AST-only port.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/custom-error-definition.md
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

var unicornCustomErrorDefinitionBaseNames = map[string]struct{}{
	"Error":          {},
	"EvalError":      {},
	"RangeError":     {},
	"ReferenceError": {},
	"SyntaxError":    {},
	"TypeError":      {},
	"URIError":       {},
	"AggregateError": {},
}

type unicornCustomErrorDefinition struct{}

func (unicornCustomErrorDefinition) Name() string {
	return "unicorn/custom-error-definition"
}
func (unicornCustomErrorDefinition) Visits() []shimast.Kind {
	return []shimast.Kind{shimast.KindClassDeclaration, shimast.KindClassExpression}
}
func (unicornCustomErrorDefinition) Check(ctx *Context, node *shimast.Node) {
	if !unicornCustomErrorDefinitionExtendsError(node) {
		return
	}
	members := classMembers(node)
	for _, member := range members {
		if member == nil || member.Kind != shimast.KindConstructor {
			continue
		}
		ctor := member.AsConstructorDeclaration()
		if ctor == nil || ctor.Body == nil {
			continue
		}
		if !unicornCustomErrorDefinitionBodyCallsSuper(ctor.Body) {
			ctx.Report(node, "A custom `Error` subclass should call `super(message)` and set `this.name`.")
			return
		}
	}
}

// unicornCustomErrorDefinitionExtendsError reports whether `class` has
// an `extends <Identifier>` heritage clause whose target identifier is
// one of the built-in Error constructors.
func unicornCustomErrorDefinitionExtendsError(class *shimast.Node) bool {
	var clauses []*shimast.Node
	switch class.Kind {
	case shimast.KindClassDeclaration:
		decl := class.AsClassDeclaration()
		if decl == nil || decl.HeritageClauses == nil {
			return false
		}
		clauses = decl.HeritageClauses.Nodes
	case shimast.KindClassExpression:
		expr := class.AsClassExpression()
		if expr == nil || expr.HeritageClauses == nil {
			return false
		}
		clauses = expr.HeritageClauses.Nodes
	default:
		return false
	}
	for _, clause := range clauses {
		if clause == nil {
			continue
		}
		hc := clause.AsHeritageClause()
		if hc == nil || hc.Token != shimast.KindExtendsKeyword || hc.Types == nil {
			continue
		}
		for _, ty := range hc.Types.Nodes {
			if ty == nil {
				continue
			}
			expr := ty.AsExpressionWithTypeArguments()
			if expr == nil {
				continue
			}
			name := identifierText(expr.Expression)
			if _, ok := unicornCustomErrorDefinitionBaseNames[name]; ok {
				return true
			}
		}
	}
	return false
}

// unicornCustomErrorDefinitionBodyCallsSuper walks the constructor body
// and reports whether any `CallExpression` whose callee is the `super`
// keyword exists at any depth. Nested function-like scopes are skipped
// — a `super(...)` inside a nested arrow does not initialize `Error`'s
// prototype state.
func unicornCustomErrorDefinitionBodyCallsSuper(body *shimast.Node) bool {
	found := false
	var walk func(*shimast.Node)
	walk = func(n *shimast.Node) {
		if n == nil || found {
			return
		}
		if n != body && isFunctionLikeKind(n) {
			return
		}
		if n.Kind == shimast.KindCallExpression {
			call := n.AsCallExpression()
			if call != nil && call.Expression != nil &&
				call.Expression.Kind == shimast.KindSuperKeyword {
				found = true
				return
			}
		}
		n.ForEachChild(func(child *shimast.Node) bool {
			walk(child)
			return false
		})
	}
	walk(body)
	return found
}

func init() {
	Register(unicornCustomErrorDefinition{})
}
