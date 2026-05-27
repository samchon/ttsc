// unicorn/prefer-class-fields: assigning a primitive literal to
// `this.<field>` inside a class constructor is a TC39-era pattern that
// modern class-field declarations now express directly. The class-field
// form is shorter, makes the field visible at the class level without
// stepping through the constructor body, and avoids accidentally
// re-initializing a property that was already declared with a typed
// declaration.
//
// AST-only: visit `KindConstructor`. For each top-level statement in the
// constructor body, fire on any `ExpressionStatement` whose expression
// is an `=` `BinaryExpression` whose LHS is a property access on
// `this` and whose RHS is a primitive literal (`StringLiteral`,
// `NumericLiteral`, `KindTrueKeyword`, `KindFalseKeyword`,
// `KindNullKeyword`). The check is per-assignment, not per-constructor,
// so a constructor mixing several such assignments reports each one.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-class-fields.md
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

type unicornPreferClassFields struct{}

func (unicornPreferClassFields) Name() string { return "unicorn/prefer-class-fields" }
func (unicornPreferClassFields) Visits() []shimast.Kind {
	return []shimast.Kind{shimast.KindConstructor}
}
func (unicornPreferClassFields) Check(ctx *Context, node *shimast.Node) {
	ctor := node.AsConstructorDeclaration()
	if ctor == nil || ctor.Body == nil {
		return
	}
	body := ctor.Body.AsBlock()
	if body == nil || body.Statements == nil {
		return
	}
	for _, stmt := range body.Statements.Nodes {
		if stmt == nil || stmt.Kind != shimast.KindExpressionStatement {
			continue
		}
		exprStmt := stmt.AsExpressionStatement()
		if exprStmt == nil || exprStmt.Expression == nil {
			continue
		}
		expr := stripParens(exprStmt.Expression)
		if expr == nil || expr.Kind != shimast.KindBinaryExpression {
			continue
		}
		bin := expr.AsBinaryExpression()
		if bin == nil || bin.OperatorToken == nil || bin.OperatorToken.Kind != shimast.KindEqualsToken {
			continue
		}
		lhs := stripParens(bin.Left)
		if lhs == nil || lhs.Kind != shimast.KindPropertyAccessExpression {
			continue
		}
		access := lhs.AsPropertyAccessExpression()
		if access == nil {
			continue
		}
		receiver := stripParens(access.Expression)
		if receiver == nil || receiver.Kind != shimast.KindThisKeyword {
			continue
		}
		rhs := stripParens(bin.Right)
		if !isPrimitiveLiteralForClassField(rhs) {
			continue
		}
		ctx.Report(expr, "Prefer class field declarations over constructor assignments to `this.field`.")
	}
}

// isPrimitiveLiteralForClassField reports whether `node` is one of the
// primitive-literal kinds that the prefer-class-fields rule treats as
// "trivially hoistable" to a class field initializer.
func isPrimitiveLiteralForClassField(node *shimast.Node) bool {
	if node == nil {
		return false
	}
	switch node.Kind {
	case shimast.KindStringLiteral,
		shimast.KindNumericLiteral,
		shimast.KindTrueKeyword,
		shimast.KindFalseKeyword,
		shimast.KindNullKeyword,
		shimast.KindNoSubstitutionTemplateLiteral:
		return true
	}
	return false
}

func init() {
	Register(unicornPreferClassFields{})
}
