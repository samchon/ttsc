// unicorn/no-for-loop: the classic `for (let i = 0; i < arr.length; i++)`
// pattern is an index-based array walk that has a direct `for…of`
// translation. The index variable, the length re-read, and the manual
// increment are all incidental bookkeeping the language now expresses
// with one keyword.
//
// AST-only and syntactic: dispatch on `ForStatement` and match the
// three classic shapes — `let i = 0` initializer, `i < X.length`
// condition (the RHS must be a `.length` access; bare counters
// `i < n` are not flagged because the suggested `for…of` rewrite does
// not apply), and `i++` incrementor. The length operand is not
// required to resolve to an array at the type level; the syntactic
// shape is the signal the rule wants to discourage.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-for-loop.md
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

type unicornNoForLoop struct{}

func (unicornNoForLoop) Name() string           { return "unicorn/no-for-loop" }
func (unicornNoForLoop) Visits() []shimast.Kind { return []shimast.Kind{shimast.KindForStatement} }
func (unicornNoForLoop) Check(ctx *Context, node *shimast.Node) {
	stmt := node.AsForStatement()
	if stmt == nil || stmt.Initializer == nil || stmt.Condition == nil || stmt.Incrementor == nil {
		return
	}
	indexName := indexInitializerName(stmt.Initializer)
	if indexName == "" {
		return
	}
	if !isLessThanCondition(stmt.Condition, indexName) {
		return
	}
	if !isPostfixIncrementOf(stmt.Incrementor, indexName) {
		return
	}
	ctx.Report(node, "Use `for…of` over an index-based `for` loop over an array.")
}

// indexInitializerName returns the variable name of a `let i = 0`
// initializer, or "" when the initializer is anything else.
func indexInitializerName(init *shimast.Node) string {
	if init == nil || init.Kind != shimast.KindVariableDeclarationList {
		return ""
	}
	list := init.AsVariableDeclarationList()
	if list == nil || list.Declarations == nil || len(list.Declarations.Nodes) != 1 {
		return ""
	}
	decl := list.Declarations.Nodes[0].AsVariableDeclaration()
	if decl == nil || decl.Initializer == nil {
		return ""
	}
	if numericLiteralText(stripParens(decl.Initializer)) != "0" {
		return ""
	}
	return identifierText(decl.Name())
}

// isLessThanCondition reports whether `cond` has the shape
// `<name> < <something>.length`. The right-hand operand must be a
// property access ending in `length`; bare counter loops such as
// `for (let i = 0; i < n; i++)` are NOT flagged because the rule's
// suggested rewrite (`for…of`) only applies to array iteration.
func isLessThanCondition(cond *shimast.Node, name string) bool {
	node := stripParens(cond)
	if node == nil || node.Kind != shimast.KindBinaryExpression {
		return false
	}
	bin := node.AsBinaryExpression()
	if bin == nil || bin.OperatorToken == nil ||
		bin.OperatorToken.Kind != shimast.KindLessThanToken {
		return false
	}
	if identifierText(stripParens(bin.Left)) != name {
		return false
	}
	right := stripParens(bin.Right)
	if right == nil || right.Kind != shimast.KindPropertyAccessExpression {
		return false
	}
	access := right.AsPropertyAccessExpression()
	return access != nil && identifierText(access.Name()) == "length"
}

// isPostfixIncrementOf reports whether `inc` has the shape `<name>++`.
func isPostfixIncrementOf(inc *shimast.Node, name string) bool {
	node := stripParens(inc)
	if node == nil || node.Kind != shimast.KindPostfixUnaryExpression {
		return false
	}
	post := node.AsPostfixUnaryExpression()
	if post == nil || post.Operator != shimast.KindPlusPlusToken {
		return false
	}
	return identifierText(post.Operand) == name
}

func init() {
	Register(unicornNoForLoop{})
}
