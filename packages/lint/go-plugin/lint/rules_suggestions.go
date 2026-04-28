// Bulk implementation of ESLint's "Suggestions" category — rules that
// don't catch outright bugs but flag stylistic or maintainability
// patterns. AST-only, no scope analysis.
package lint

import (
	"strings"

	shimast "github.com/microsoft/typescript-go/shim/ast"
)

// no-alert: `alert()` / `confirm()` / `prompt()`. Rarely the right
// answer in production code.
type noAlert struct{}

func (noAlert) Name() string             { return "no-alert" }
func (noAlert) Visits() []shimast.Kind   { return []shimast.Kind{shimast.KindCallExpression} }
func (noAlert) Check(ctx *Context, node *shimast.Node) {
	call := node.AsCallExpression()
	if call == nil {
		return
	}
	switch callCalleeName(call) {
	case "alert", "confirm", "prompt":
		ctx.Report(node, "Unexpected "+callCalleeName(call)+".")
	}
}

// no-bitwise: `&`, `|`, `^`, `~`, `<<`, `>>`, `>>>` — almost always a
// typo for the boolean-logic operators.
type noBitwise struct{}

func (noBitwise) Name() string { return "no-bitwise" }
func (noBitwise) Visits() []shimast.Kind {
	return []shimast.Kind{shimast.KindBinaryExpression, shimast.KindPrefixUnaryExpression}
}
func (noBitwise) Check(ctx *Context, node *shimast.Node) {
	if node.Kind == shimast.KindBinaryExpression {
		expr := node.AsBinaryExpression()
		if expr == nil || expr.OperatorToken == nil {
			return
		}
		switch expr.OperatorToken.Kind {
		case shimast.KindAmpersandToken,
			shimast.KindBarToken,
			shimast.KindCaretToken,
			shimast.KindLessThanLessThanToken,
			shimast.KindGreaterThanGreaterThanToken,
			shimast.KindGreaterThanGreaterThanGreaterThanToken,
			shimast.KindAmpersandEqualsToken,
			shimast.KindBarEqualsToken,
			shimast.KindCaretEqualsToken,
			shimast.KindLessThanLessThanEqualsToken,
			shimast.KindGreaterThanGreaterThanEqualsToken,
			shimast.KindGreaterThanGreaterThanGreaterThanEqualsToken:
			ctx.Report(node, "Unexpected use of bitwise operator.")
		}
		return
	}
	prefix := node.AsPrefixUnaryExpression()
	if prefix == nil {
		return
	}
	if prefix.Operator == shimast.KindTildeToken {
		ctx.Report(node, "Unexpected use of bitwise operator.")
	}
}

// no-caller: `arguments.caller` / `arguments.callee` — strict-mode
// errors elsewhere; lint catches them earlier.
type noCaller struct{}

func (noCaller) Name() string             { return "no-caller" }
func (noCaller) Visits() []shimast.Kind   { return []shimast.Kind{shimast.KindPropertyAccessExpression} }
func (noCaller) Check(ctx *Context, node *shimast.Node) {
	access := node.AsPropertyAccessExpression()
	if access == nil {
		return
	}
	if identifierText(access.Expression) != "arguments" {
		return
	}
	switch identifierText(access.Name()) {
	case "caller", "callee":
		ctx.Report(node, "Avoid arguments."+identifierText(access.Name())+".")
	}
}

// no-case-declarations: `switch (x) { case 1: let y = 2; break; }` —
// block-scoped declarations leak across case labels.
type noCaseDeclarations struct{}

func (noCaseDeclarations) Name() string { return "no-case-declarations" }
func (noCaseDeclarations) Visits() []shimast.Kind {
	return []shimast.Kind{shimast.KindCaseClause, shimast.KindDefaultClause}
}
func (noCaseDeclarations) Check(ctx *Context, node *shimast.Node) {
	clause := node.AsCaseOrDefaultClause()
	if clause == nil || clause.Statements == nil {
		return
	}
	for _, stmt := range clause.Statements.Nodes {
		if stmt == nil {
			continue
		}
		if stmt.Kind == shimast.KindVariableStatement {
			vstmt := stmt.AsVariableStatement()
			if vstmt != nil && vstmt.DeclarationList != nil && !shimast.IsVar(vstmt.DeclarationList) {
				ctx.Report(stmt, "Unexpected lexical declaration in case block.")
				continue
			}
		}
		switch stmt.Kind {
		case shimast.KindFunctionDeclaration, shimast.KindClassDeclaration:
			ctx.Report(stmt, "Unexpected lexical declaration in case block.")
		}
	}
}

// no-continue: `continue` keyword. ESLint flags it as a code-smell
// (loop body should usually be reorganized).
type noContinue struct{}

func (noContinue) Name() string             { return "no-continue" }
func (noContinue) Visits() []shimast.Kind   { return []shimast.Kind{shimast.KindContinueStatement} }
func (noContinue) Check(ctx *Context, node *shimast.Node) {
	ctx.Report(node, "Unexpected use of continue statement.")
}

// no-delete-var: `delete x` where `x` is a variable. Strict-mode error.
type noDeleteVar struct{}

func (noDeleteVar) Name() string             { return "no-delete-var" }
func (noDeleteVar) Visits() []shimast.Kind   { return []shimast.Kind{shimast.KindDeleteExpression} }
func (noDeleteVar) Check(ctx *Context, node *shimast.Node) {
	del := node.AsDeleteExpression()
	if del == nil {
		return
	}
	if del.Expression != nil && del.Expression.Kind == shimast.KindIdentifier {
		ctx.Report(node, "Variables should not be deleted.")
	}
}

// no-eq-null: `x == null` — ambiguous with eqeqeq's `null` exception
// when developers want to also catch `undefined`.
type noEqNull struct{}

func (noEqNull) Name() string             { return "no-eq-null" }
func (noEqNull) Visits() []shimast.Kind   { return []shimast.Kind{shimast.KindBinaryExpression} }
func (noEqNull) Check(ctx *Context, node *shimast.Node) {
	expr := node.AsBinaryExpression()
	if expr == nil || expr.OperatorToken == nil {
		return
	}
	if expr.OperatorToken.Kind != shimast.KindEqualsEqualsToken && expr.OperatorToken.Kind != shimast.KindExclamationEqualsToken {
		return
	}
	if isNullLiteral(expr.Left) || isNullLiteral(expr.Right) {
		ctx.Report(node, "Use '===' to compare with null.")
	}
}

func isNullLiteral(node *shimast.Node) bool {
	return node != nil && node.Kind == shimast.KindNullKeyword
}

// no-extra-bind: `(function () {}).bind(this)` where `this` isn't used
// — only flag the case where the bind target is empty/parameterless,
// keeping false-positives down.
type noExtraBind struct{}

func (noExtraBind) Name() string             { return "no-extra-bind" }
func (noExtraBind) Visits() []shimast.Kind   { return []shimast.Kind{shimast.KindCallExpression} }
func (noExtraBind) Check(ctx *Context, node *shimast.Node) {
	call := node.AsCallExpression()
	if call == nil || call.Expression == nil {
		return
	}
	if call.Expression.Kind != shimast.KindPropertyAccessExpression {
		return
	}
	access := call.Expression.AsPropertyAccessExpression()
	if access == nil || identifierText(access.Name()) != "bind" {
		return
	}
	target := stripParens(access.Expression)
	if target == nil {
		return
	}
	if target.Kind != shimast.KindArrowFunction && target.Kind != shimast.KindFunctionExpression {
		return
	}
	// Arrow functions don't have their own `this`; `.bind` is always
	// useless on them.
	if target.Kind == shimast.KindArrowFunction {
		ctx.Report(node, "The function binding is unnecessary.")
		return
	}
	body := target.Body()
	if body != nil && !bodyReferencesThis(body) {
		ctx.Report(node, "The function binding is unnecessary.")
	}
}

func bodyReferencesThis(node *shimast.Node) bool {
	if node == nil {
		return false
	}
	if node.Kind == shimast.KindThisKeyword {
		return true
	}
	// Don't descend into nested function-likes — their `this` is
	// independent.
	if isFunctionLikeKind(node) && node.Parent != nil {
		return false
	}
	found := false
	node.ForEachChild(func(child *shimast.Node) bool {
		if found {
			return true
		}
		if bodyReferencesThis(child) {
			found = true
			return true
		}
		return false
	})
	return found
}

// no-labels: labels (`outer: for (...) { break outer; }`) are
// confusing and rarely needed.
type noLabels struct{}

func (noLabels) Name() string             { return "no-labels" }
func (noLabels) Visits() []shimast.Kind   { return []shimast.Kind{shimast.KindLabeledStatement} }
func (noLabels) Check(ctx *Context, node *shimast.Node) {
	ctx.Report(node, "Unexpected labeled statement.")
}

// no-lone-blocks: `{ doStuff(); }` outside a control flow context —
// the braces add no scope (in non-strict mode) and obscure intent.
type noLoneBlocks struct{}

func (noLoneBlocks) Name() string             { return "no-lone-blocks" }
func (noLoneBlocks) Visits() []shimast.Kind   { return []shimast.Kind{shimast.KindBlock} }
func (noLoneBlocks) Check(ctx *Context, node *shimast.Node) {
	parent := node.Parent
	if parent == nil {
		return
	}
	switch parent.Kind {
	case shimast.KindBlock, shimast.KindSourceFile, shimast.KindModuleBlock:
	default:
		return
	}
	// Skip blocks that are themselves a function/method body — those
	// are tracked by isFunctionLikeKind on the parent.
	if isFunctionLikeKind(parent) {
		return
	}
	block := node.AsBlock()
	if block == nil || block.Statements == nil {
		return
	}
	// Empty block is `no-empty`'s domain.
	if len(block.Statements.Nodes) == 0 {
		return
	}
	// Allow blocks whose only contents are block-scoped declarations
	// (`{ const x = 1; }` is occasionally used to limit scope).
	for _, stmt := range block.Statements.Nodes {
		if stmt == nil {
			continue
		}
		if stmt.Kind == shimast.KindVariableStatement {
			vstmt := stmt.AsVariableStatement()
			if vstmt != nil && vstmt.DeclarationList != nil && !shimast.IsVar(vstmt.DeclarationList) {
				return
			}
		}
		if stmt.Kind == shimast.KindClassDeclaration || stmt.Kind == shimast.KindFunctionDeclaration {
			return
		}
	}
	ctx.Report(node, "Block is redundant.")
}

// no-lonely-if: `else { if (...) {...} }` should be `else if (...)`.
type noLonelyIf struct{}

func (noLonelyIf) Name() string             { return "no-lonely-if" }
func (noLonelyIf) Visits() []shimast.Kind   { return []shimast.Kind{shimast.KindIfStatement} }
func (noLonelyIf) Check(ctx *Context, node *shimast.Node) {
	parent := node.Parent
	if parent == nil || parent.Kind != shimast.KindBlock {
		return
	}
	block := parent.AsBlock()
	if block == nil || block.Statements == nil {
		return
	}
	if len(block.Statements.Nodes) != 1 {
		return
	}
	grand := parent.Parent
	if grand == nil || grand.Kind != shimast.KindIfStatement {
		return
	}
	gif := grand.AsIfStatement()
	if gif == nil || gif.ElseStatement != parent {
		return
	}
	ctx.Report(node, "Unexpected if as the only statement in an else block.")
}

// no-multi-assign: `a = b = 1`. Confusing right-to-left chains.
type noMultiAssign struct{}

func (noMultiAssign) Name() string             { return "no-multi-assign" }
func (noMultiAssign) Visits() []shimast.Kind   { return []shimast.Kind{shimast.KindBinaryExpression} }
func (noMultiAssign) Check(ctx *Context, node *shimast.Node) {
	expr := node.AsBinaryExpression()
	if expr == nil || expr.OperatorToken == nil {
		return
	}
	if expr.OperatorToken.Kind != shimast.KindEqualsToken {
		return
	}
	if expr.Right != nil && expr.Right.Kind == shimast.KindBinaryExpression {
		inner := expr.Right.AsBinaryExpression()
		if inner != nil && inner.OperatorToken != nil && inner.OperatorToken.Kind == shimast.KindEqualsToken {
			ctx.Report(node, "Unexpected chained assignment.")
		}
	}
}

// no-negated-condition: `if (!x) {} else {}`. Easier to read with the
// branches swapped.
type noNegatedCondition struct{}

func (noNegatedCondition) Name() string { return "no-negated-condition" }
func (noNegatedCondition) Visits() []shimast.Kind {
	return []shimast.Kind{shimast.KindIfStatement, shimast.KindConditionalExpression}
}
func (noNegatedCondition) Check(ctx *Context, node *shimast.Node) {
	if node.Kind == shimast.KindIfStatement {
		stmt := node.AsIfStatement()
		if stmt == nil || stmt.ElseStatement == nil {
			return
		}
		// Allow `else if` chains — the branches aren't symmetric.
		if stmt.ElseStatement.Kind == shimast.KindIfStatement {
			return
		}
		if isNegatedExpression(stmt.Expression) {
			ctx.Report(node, "Unexpected negated condition.")
		}
		return
	}
	cond := node.AsConditionalExpression()
	if cond == nil {
		return
	}
	if isNegatedExpression(cond.Condition) {
		ctx.Report(node, "Unexpected negated condition.")
	}
}

func isNegatedExpression(node *shimast.Node) bool {
	expr := stripParens(node)
	if expr == nil {
		return false
	}
	if expr.Kind == shimast.KindPrefixUnaryExpression {
		prefix := expr.AsPrefixUnaryExpression()
		if prefix != nil && prefix.Operator == shimast.KindExclamationToken {
			return true
		}
	}
	if expr.Kind == shimast.KindBinaryExpression {
		bin := expr.AsBinaryExpression()
		if bin != nil && bin.OperatorToken != nil {
			switch bin.OperatorToken.Kind {
			case shimast.KindExclamationEqualsToken, shimast.KindExclamationEqualsEqualsToken:
				return true
			}
		}
	}
	return false
}

// no-nested-ternary: `a ? b : c ? d : e`.
type noNestedTernary struct{}

func (noNestedTernary) Name() string             { return "no-nested-ternary" }
func (noNestedTernary) Visits() []shimast.Kind   { return []shimast.Kind{shimast.KindConditionalExpression} }
func (noNestedTernary) Check(ctx *Context, node *shimast.Node) {
	cond := node.AsConditionalExpression()
	if cond == nil {
		return
	}
	if hasConditional(cond.WhenTrue) || hasConditional(cond.WhenFalse) {
		ctx.Report(node, "Do not nest ternary expressions.")
	}
}

func hasConditional(node *shimast.Node) bool {
	expr := stripParens(node)
	return expr != nil && expr.Kind == shimast.KindConditionalExpression
}

// no-new: `new Foo()` whose result is discarded. Either store it or
// avoid the constructor.
type noNew struct{}

func (noNew) Name() string             { return "no-new" }
func (noNew) Visits() []shimast.Kind   { return []shimast.Kind{shimast.KindExpressionStatement} }
func (noNew) Check(ctx *Context, node *shimast.Node) {
	stmt := node.AsExpressionStatement()
	if stmt == nil || stmt.Expression == nil {
		return
	}
	if stmt.Expression.Kind == shimast.KindNewExpression {
		ctx.Report(node, "Do not use 'new' for side effects.")
	}
}

// no-new-func: `new Function("...")` — a third form of dynamic eval.
type noNewFunc struct{}

func (noNewFunc) Name() string             { return "no-new-func" }
func (noNewFunc) Visits() []shimast.Kind   { return []shimast.Kind{shimast.KindNewExpression, shimast.KindCallExpression} }
func (noNewFunc) Check(ctx *Context, node *shimast.Node) {
	var callee *shimast.Node
	if node.Kind == shimast.KindNewExpression {
		callee = node.AsNewExpression().Expression
	} else {
		callee = node.AsCallExpression().Expression
	}
	if identifierText(callee) == "Function" {
		ctx.Report(node, "The Function constructor is eval.")
	}
}

// no-object-constructor: `new Object()` / `Object()` — same shape as
// no-array-constructor but for objects.
type noObjectConstructor struct{}

func (noObjectConstructor) Name() string             { return "no-object-constructor" }
func (noObjectConstructor) Visits() []shimast.Kind   { return []shimast.Kind{shimast.KindNewExpression, shimast.KindCallExpression} }
func (noObjectConstructor) Check(ctx *Context, node *shimast.Node) {
	var callee *shimast.Node
	var argCount int
	if node.Kind == shimast.KindNewExpression {
		ne := node.AsNewExpression()
		callee = ne.Expression
		if ne.Arguments != nil {
			argCount = len(ne.Arguments.Nodes)
		}
	} else {
		call := node.AsCallExpression()
		callee = call.Expression
		if call.Arguments != nil {
			argCount = len(call.Arguments.Nodes)
		}
	}
	if argCount != 0 {
		return // 1+ args is a "make a wrapper", not "make an empty object".
	}
	if identifierText(callee) == "Object" {
		ctx.Report(node, "The object literal notation {} is preferable.")
	}
}

// no-octal-escape: `"\251"` — octal escapes in string literals are
// deprecated and forbidden in template literals.
type noOctalEscape struct{}

func (noOctalEscape) Name() string             { return "no-octal-escape" }
func (noOctalEscape) Visits() []shimast.Kind   { return []shimast.Kind{shimast.KindStringLiteral, shimast.KindNoSubstitutionTemplateLiteral} }
func (noOctalEscape) Check(ctx *Context, node *shimast.Node) {
	src := nodeText(ctx.File, node)
	if hasOctalEscape(src) {
		ctx.Report(node, "Don't use octal escape sequences.")
	}
}

func hasOctalEscape(src string) bool {
	for i := 0; i < len(src)-1; i++ {
		if src[i] != '\\' {
			continue
		}
		next := src[i+1]
		// A literal `\0` followed by a non-digit is not an octal
		// escape, just NUL — those are allowed.
		if next < '0' || next > '7' {
			i++
			continue
		}
		if next == '0' {
			if i+2 >= len(src) || src[i+2] < '0' || src[i+2] > '9' {
				i++
				continue
			}
		}
		return true
	}
	return false
}

// no-plusplus: `++x` / `x++`. Equivalent to `x += 1`, considered less
// clear in some style guides.
type noPlusPlus struct{}

func (noPlusPlus) Name() string { return "no-plusplus" }
func (noPlusPlus) Visits() []shimast.Kind {
	return []shimast.Kind{shimast.KindPrefixUnaryExpression, shimast.KindPostfixUnaryExpression}
}
func (noPlusPlus) Check(ctx *Context, node *shimast.Node) {
	var op shimast.Kind
	if node.Kind == shimast.KindPrefixUnaryExpression {
		op = node.AsPrefixUnaryExpression().Operator
	} else {
		op = node.AsPostfixUnaryExpression().Operator
	}
	switch op {
	case shimast.KindPlusPlusToken, shimast.KindMinusMinusToken:
		ctx.Report(node, "Unary operator '++'/'--' used.")
	}
}

// no-regex-spaces: multiple spaces in a regex literal — confusing
// because the count is invisible.
type noRegexSpaces struct{}

func (noRegexSpaces) Name() string             { return "no-regex-spaces" }
func (noRegexSpaces) Visits() []shimast.Kind   { return []shimast.Kind{shimast.KindRegularExpressionLiteral} }
func (noRegexSpaces) Check(ctx *Context, node *shimast.Node) {
	src := nodeText(ctx.File, node)
	if regexHasMultipleSpaces(src) {
		ctx.Report(node, "Spaces are hard to count. Use {N}.")
	}
}

func regexHasMultipleSpaces(src string) bool {
	// Strip trailing flags.
	end := strings.LastIndex(src, "/")
	if end <= 0 {
		return false
	}
	body := src[:end]
	inClass := false
	run := 0
	for i := 0; i < len(body); i++ {
		c := body[i]
		switch c {
		case '\\':
			i++
			run = 0
		case '[':
			inClass = true
			run = 0
		case ']':
			inClass = false
			run = 0
		case ' ':
			if inClass {
				run = 0
				continue
			}
			run++
			if run >= 2 {
				return true
			}
		default:
			run = 0
		}
	}
	return false
}

// no-return-assign: `return a = b` mixes assignment with return.
type noReturnAssign struct{}

func (noReturnAssign) Name() string             { return "no-return-assign" }
func (noReturnAssign) Visits() []shimast.Kind   { return []shimast.Kind{shimast.KindReturnStatement, shimast.KindArrowFunction} }
func (noReturnAssign) Check(ctx *Context, node *shimast.Node) {
	switch node.Kind {
	case shimast.KindReturnStatement:
		ret := node.AsReturnStatement()
		if ret == nil || ret.Expression == nil {
			return
		}
		if isAssignmentExpression(stripParens(ret.Expression)) {
			ctx.Report(node, "Return statement should not contain assignment.")
		}
	case shimast.KindArrowFunction:
		arrow := node.AsArrowFunction()
		if arrow == nil || arrow.Body == nil || arrow.Body.Kind == shimast.KindBlock {
			return
		}
		if isAssignmentExpression(stripParens(arrow.Body)) {
			ctx.Report(node, "Arrow function should not return an assignment.")
		}
	}
}

// no-sequences: `(a, b)` — comma operator. Almost always a confusing
// pattern outside of `for` headers.
type noSequences struct{}

func (noSequences) Name() string             { return "no-sequences" }
func (noSequences) Visits() []shimast.Kind   { return []shimast.Kind{shimast.KindBinaryExpression} }
func (noSequences) Check(ctx *Context, node *shimast.Node) {
	expr := node.AsBinaryExpression()
	if expr == nil || expr.OperatorToken == nil {
		return
	}
	if expr.OperatorToken.Kind != shimast.KindCommaToken {
		return
	}
	// `for (a; b; c)` headers naturally use the comma operator;
	// suppress when the parent is a ForStatement initializer/incrementor.
	parent := node.Parent
	if parent != nil && parent.Kind == shimast.KindForStatement {
		return
	}
	// Allow when wrapped in parens (the canonical "I really mean it"
	// idiom).
	if parent != nil && parent.Kind == shimast.KindParenthesizedExpression {
		return
	}
	ctx.Report(node, "Unexpected use of comma operator.")
}

// no-shadow-restricted-names: redeclaring `undefined`, `NaN`, `Infinity`,
// `arguments`, or `eval`.
type noShadowRestrictedNames struct{}

func (noShadowRestrictedNames) Name() string { return "no-shadow-restricted-names" }
func (noShadowRestrictedNames) Visits() []shimast.Kind {
	return []shimast.Kind{shimast.KindVariableDeclaration, shimast.KindParameter, shimast.KindFunctionDeclaration}
}
func (noShadowRestrictedNames) Check(ctx *Context, node *shimast.Node) {
	var nameNode *shimast.Node
	switch node.Kind {
	case shimast.KindVariableDeclaration:
		nameNode = node.AsVariableDeclaration().Name()
	case shimast.KindParameter:
		nameNode = node.AsParameterDeclaration().Name()
	case shimast.KindFunctionDeclaration:
		nameNode = node.AsFunctionDeclaration().Name()
	}
	name := identifierText(nameNode)
	if name == "" {
		return
	}
	switch name {
	case "undefined", "NaN", "Infinity", "arguments", "eval":
		ctx.Report(node, "Shadowing of global property '"+name+"'.")
	}
}

// no-undefined: literal `undefined` (vs `void 0`). Easier to misuse
// because it's writable in older environments.
type noUndefined struct{}

func (noUndefined) Name() string             { return "no-undefined" }
func (noUndefined) Visits() []shimast.Kind   { return []shimast.Kind{shimast.KindIdentifier} }
func (noUndefined) Check(ctx *Context, node *shimast.Node) {
	if identifierText(node) != "undefined" {
		return
	}
	parent := node.Parent
	if parent == nil {
		return
	}
	// Don't flag a declaration *named* `undefined` (no-shadow-restricted-names
	// covers that), or a member-access / object-key position
	// (`x.undefined`, `{ undefined: 1 }`).
	switch parent.Kind {
	case shimast.KindParameter:
		decl := parent.AsParameterDeclaration()
		if decl != nil && decl.Name() != nil && nodesShareLoc(decl.Name(), node) {
			return
		}
	case shimast.KindVariableDeclaration:
		decl := parent.AsVariableDeclaration()
		if decl != nil && decl.Name() != nil && nodesShareLoc(decl.Name(), node) {
			return
		}
	case shimast.KindPropertyAccessExpression:
		access := parent.AsPropertyAccessExpression()
		if access != nil && access.Name() != nil && nodesShareLoc(access.Name(), node) {
			return
		}
	case shimast.KindPropertyAssignment:
		assign := parent.AsPropertyAssignment()
		if assign != nil && assign.Name() != nil && nodesShareLoc(assign.Name(), node) {
			return
		}
	}
	ctx.Report(node, "Unexpected use of undefined.")
}

// nodesShareLoc reports whether two `*ast.Node` references describe the
// same syntactic site. Identity comparison is unreliable when the
// parser exposes its fields through accessor methods that may return
// fresh wrappers; comparing positions works regardless.
func nodesShareLoc(a, b *shimast.Node) bool {
	if a == nil || b == nil {
		return false
	}
	return a == b || (a.Pos() == b.Pos() && a.End() == b.End())
}

// no-unneeded-ternary: `x ? true : false` → `Boolean(x)` / `!!x`.
type noUnneededTernary struct{}

func (noUnneededTernary) Name() string             { return "no-unneeded-ternary" }
func (noUnneededTernary) Visits() []shimast.Kind   { return []shimast.Kind{shimast.KindConditionalExpression} }
func (noUnneededTernary) Check(ctx *Context, node *shimast.Node) {
	cond := node.AsConditionalExpression()
	if cond == nil {
		return
	}
	t := stripParens(cond.WhenTrue)
	f := stripParens(cond.WhenFalse)
	tBool, tOk := isLiteralBoolean(t)
	fBool, fOk := isLiteralBoolean(f)
	if tOk && fOk && tBool != fBool {
		ctx.Report(node, "Unnecessary use of conditional expression for boolean.")
	}
}

// no-unused-expressions: an expression statement whose value isn't used.
// Filtered down to common patterns ESLint flags by default.
type noUnusedExpressions struct{}

func (noUnusedExpressions) Name() string             { return "no-unused-expressions" }
func (noUnusedExpressions) Visits() []shimast.Kind   { return []shimast.Kind{shimast.KindExpressionStatement} }
func (noUnusedExpressions) Check(ctx *Context, node *shimast.Node) {
	stmt := node.AsExpressionStatement()
	if stmt == nil || stmt.Expression == nil {
		return
	}
	if isProductiveExpression(stmt.Expression) {
		return
	}
	ctx.Report(node, "Expected an assignment or function call and instead saw an expression.")
}

func isProductiveExpression(node *shimast.Node) bool {
	expr := stripParens(node)
	if expr == nil {
		return false
	}
	switch expr.Kind {
	case shimast.KindCallExpression,
		shimast.KindNewExpression,
		shimast.KindAwaitExpression,
		shimast.KindYieldExpression,
		shimast.KindDeleteExpression,
		shimast.KindBinaryExpression,
		shimast.KindPrefixUnaryExpression,
		shimast.KindPostfixUnaryExpression,
		shimast.KindTaggedTemplateExpression:
		// These can have side effects. The narrower checks
		// (no-cond-assign, no-bitwise) handle the suspicious shapes.
		switch expr.Kind {
		case shimast.KindBinaryExpression:
			bin := expr.AsBinaryExpression()
			if bin != nil && bin.OperatorToken != nil && isAssignmentOperator(bin.OperatorToken.Kind) {
				return true
			}
			return false
		case shimast.KindPrefixUnaryExpression:
			prefix := expr.AsPrefixUnaryExpression()
			if prefix != nil && (prefix.Operator == shimast.KindPlusPlusToken || prefix.Operator == shimast.KindMinusMinusToken) {
				return true
			}
			return false
		case shimast.KindPostfixUnaryExpression:
			return true
		}
		return true
	case shimast.KindStringLiteral:
		// "use strict" prologue.
		text := expr.AsStringLiteral()
		if text != nil && (text.Text == "use strict" || text.Text == "use asm") {
			return true
		}
	}
	return false
}

// no-useless-call: `func.call(undefined, ...args)` / `func.apply(undefined, args)`
// — call/apply with no this binding is just a regular call.
type noUselessCall struct{}

func (noUselessCall) Name() string             { return "no-useless-call" }
func (noUselessCall) Visits() []shimast.Kind   { return []shimast.Kind{shimast.KindCallExpression} }
func (noUselessCall) Check(ctx *Context, node *shimast.Node) {
	call := node.AsCallExpression()
	if call == nil || call.Expression == nil || call.Expression.Kind != shimast.KindPropertyAccessExpression {
		return
	}
	access := call.Expression.AsPropertyAccessExpression()
	method := identifierText(access.Name())
	if method != "call" && method != "apply" {
		return
	}
	if call.Arguments == nil || len(call.Arguments.Nodes) == 0 {
		return
	}
	first := call.Arguments.Nodes[0]
	first = stripParens(first)
	if first == nil {
		return
	}
	if first.Kind == shimast.KindNullKeyword || identifierText(first) == "undefined" {
		ctx.Report(node, "Unnecessary "+method+"().")
	}
}

// no-useless-computed-key: `{ ["foo"]: 1 }` could be `{ foo: 1 }`.
type noUselessComputedKey struct{}

func (noUselessComputedKey) Name() string { return "no-useless-computed-key" }
func (noUselessComputedKey) Visits() []shimast.Kind {
	return []shimast.Kind{shimast.KindPropertyAssignment, shimast.KindMethodDeclaration}
}
func (noUselessComputedKey) Check(ctx *Context, node *shimast.Node) {
	var name *shimast.Node
	switch node.Kind {
	case shimast.KindPropertyAssignment:
		name = node.AsPropertyAssignment().Name()
	case shimast.KindMethodDeclaration:
		name = node.AsMethodDeclaration().Name()
	}
	if name == nil || name.Kind != shimast.KindComputedPropertyName {
		return
	}
	computed := name.AsComputedPropertyName()
	if computed == nil || computed.Expression == nil {
		return
	}
	// Only fire when the computed key is a string / numeric / template
	// literal — a bare identifier inside `[ ]` reads its *value* and is
	// not equivalent to the same identifier as a static key.
	expr := stripParens(computed.Expression)
	switch expr.Kind {
	case shimast.KindStringLiteral,
		shimast.KindNoSubstitutionTemplateLiteral,
		shimast.KindNumericLiteral,
		shimast.KindBigIntLiteral:
		ctx.Report(name, "Unnecessarily computed property key.")
	}
}

// no-useless-rename: `import { x as x } from ...` / `const { x: x } = obj`
// — the rename is a no-op.
type noUselessRename struct{}

func (noUselessRename) Name() string { return "no-useless-rename" }
func (noUselessRename) Visits() []shimast.Kind {
	return []shimast.Kind{shimast.KindImportSpecifier, shimast.KindExportSpecifier, shimast.KindBindingElement}
}
func (noUselessRename) Check(ctx *Context, node *shimast.Node) {
	switch node.Kind {
	case shimast.KindImportSpecifier:
		spec := node.AsImportSpecifier()
		if spec == nil || spec.PropertyName == nil {
			return
		}
		if identifierText(spec.PropertyName) == identifierText(spec.Name()) {
			ctx.Report(node, "Import { x as x } is redundant.")
		}
	case shimast.KindExportSpecifier:
		spec := node.AsExportSpecifier()
		if spec == nil || spec.PropertyName == nil {
			return
		}
		if identifierText(spec.PropertyName) == identifierText(spec.Name()) {
			ctx.Report(node, "Export { x as x } is redundant.")
		}
	case shimast.KindBindingElement:
		el := node.AsBindingElement()
		if el == nil || el.PropertyName == nil {
			return
		}
		if identifierText(el.PropertyName) == identifierText(el.Name()) {
			ctx.Report(node, "Destructuring rename to the same name is redundant.")
		}
	}
}

// object-shorthand: `{ x: x }` → `{ x }`.
type objectShorthand struct{}

func (objectShorthand) Name() string             { return "object-shorthand" }
func (objectShorthand) Visits() []shimast.Kind   { return []shimast.Kind{shimast.KindPropertyAssignment} }
func (objectShorthand) Check(ctx *Context, node *shimast.Node) {
	prop := node.AsPropertyAssignment()
	if prop == nil || prop.Name() == nil || prop.Initializer == nil {
		return
	}
	keyName := identifierText(prop.Name())
	valueName := identifierText(prop.Initializer)
	if keyName == "" || valueName == "" {
		return
	}
	if keyName == valueName {
		ctx.Report(node, "Expected property shorthand.")
	}
}

// operator-assignment: `x = x + 1` → `x += 1`.
type operatorAssignment struct{}

func (operatorAssignment) Name() string             { return "operator-assignment" }
func (operatorAssignment) Visits() []shimast.Kind   { return []shimast.Kind{shimast.KindBinaryExpression} }
func (operatorAssignment) Check(ctx *Context, node *shimast.Node) {
	expr := node.AsBinaryExpression()
	if expr == nil || expr.OperatorToken == nil {
		return
	}
	if expr.OperatorToken.Kind != shimast.KindEqualsToken {
		return
	}
	if expr.Right == nil || expr.Right.Kind != shimast.KindBinaryExpression {
		return
	}
	right := expr.Right.AsBinaryExpression()
	if right == nil || right.OperatorToken == nil {
		return
	}
	if !isCompoundEligibleOperator(right.OperatorToken.Kind) {
		return
	}
	if nodeText(ctx.File, expr.Left) == nodeText(ctx.File, right.Left) {
		ctx.Report(node, "Assignment can be replaced with compound operator.")
	}
}

func isCompoundEligibleOperator(kind shimast.Kind) bool {
	switch kind {
	case shimast.KindPlusToken, shimast.KindAsteriskToken, shimast.KindSlashToken,
		shimast.KindAsteriskAsteriskToken, shimast.KindAmpersandToken, shimast.KindBarToken,
		shimast.KindCaretToken:
		return true
	}
	return false
}

// prefer-exponentiation-operator: `Math.pow(a, b)` → `a ** b`.
type preferExponentiationOperator struct{}

func (preferExponentiationOperator) Name() string             { return "prefer-exponentiation-operator" }
func (preferExponentiationOperator) Visits() []shimast.Kind   { return []shimast.Kind{shimast.KindCallExpression} }
func (preferExponentiationOperator) Check(ctx *Context, node *shimast.Node) {
	call := node.AsCallExpression()
	if call == nil {
		return
	}
	if !isMatchingPropertyAccess(call.Expression, "Math", "pow") {
		return
	}
	ctx.Report(node, "Use the '**' operator instead of 'Math.pow'.")
}

// prefer-spread: `fn.apply(null, args)` → `fn(...args)`.
type preferSpread struct{}

func (preferSpread) Name() string             { return "prefer-spread" }
func (preferSpread) Visits() []shimast.Kind   { return []shimast.Kind{shimast.KindCallExpression} }
func (preferSpread) Check(ctx *Context, node *shimast.Node) {
	call := node.AsCallExpression()
	if call == nil || call.Expression == nil {
		return
	}
	if call.Expression.Kind != shimast.KindPropertyAccessExpression {
		return
	}
	access := call.Expression.AsPropertyAccessExpression()
	if access == nil || identifierText(access.Name()) != "apply" {
		return
	}
	if call.Arguments == nil || len(call.Arguments.Nodes) != 2 {
		return
	}
	first := stripParens(call.Arguments.Nodes[0])
	if first == nil {
		return
	}
	// ESLint default: only fire when the `this` arg is null/undefined,
	// which is the canonical "I just want to spread" pattern.
	if first.Kind == shimast.KindNullKeyword || identifierText(first) == "undefined" {
		ctx.Report(node, "Use the spread operator instead of '.apply()'.")
	}
}

// prefer-template: string concatenation that would read better as a
// template literal — heuristic: any `+` involving a string literal AND
// a non-literal.
type preferTemplate struct{}

func (preferTemplate) Name() string             { return "prefer-template" }
func (preferTemplate) Visits() []shimast.Kind   { return []shimast.Kind{shimast.KindBinaryExpression} }
func (preferTemplate) Check(ctx *Context, node *shimast.Node) {
	expr := node.AsBinaryExpression()
	if expr == nil || expr.OperatorToken == nil {
		return
	}
	if expr.OperatorToken.Kind != shimast.KindPlusToken {
		return
	}
	// Skip when the parent is also a string-concat — only the topmost
	// `+` chain emits one finding.
	parent := node.Parent
	if parent != nil && parent.Kind == shimast.KindBinaryExpression {
		parentBin := parent.AsBinaryExpression()
		if parentBin != nil && parentBin.OperatorToken != nil && parentBin.OperatorToken.Kind == shimast.KindPlusToken {
			return
		}
	}
	hasString, hasOther := concatChainShape(node)
	if hasString && hasOther {
		ctx.Report(node, "Unexpected string concatenation.")
	}
}

func concatChainShape(node *shimast.Node) (hasString bool, hasOther bool) {
	if node == nil {
		return false, false
	}
	if node.Kind == shimast.KindBinaryExpression {
		bin := node.AsBinaryExpression()
		if bin != nil && bin.OperatorToken != nil && bin.OperatorToken.Kind == shimast.KindPlusToken {
			ls, lo := concatChainShape(bin.Left)
			rs, ro := concatChainShape(bin.Right)
			return ls || rs, lo || ro
		}
	}
	if isStringLikeLiteral(stripParens(node)) {
		return true, false
	}
	return false, true
}

// require-yield: `function* gen() { return 1; }` — generators that
// never yield are usually unintended.
type requireYield struct{}

func (requireYield) Name() string             { return "require-yield" }
func (requireYield) Visits() []shimast.Kind   { return []shimast.Kind{shimast.KindFunctionDeclaration, shimast.KindFunctionExpression, shimast.KindMethodDeclaration} }
func (requireYield) Check(ctx *Context, node *shimast.Node) {
	if !hasAsteriskModifier(node) {
		return
	}
	body := node.Body()
	if body == nil {
		return
	}
	if !subtreeContainsYield(body) {
		ctx.Report(node, "This generator function does not have 'yield'.")
	}
}

func hasAsteriskModifier(node *shimast.Node) bool {
	if node == nil {
		return false
	}
	switch node.Kind {
	case shimast.KindFunctionDeclaration:
		decl := node.AsFunctionDeclaration()
		return decl != nil && decl.AsteriskToken != nil
	case shimast.KindFunctionExpression:
		decl := node.AsFunctionExpression()
		return decl != nil && decl.AsteriskToken != nil
	case shimast.KindMethodDeclaration:
		decl := node.AsMethodDeclaration()
		return decl != nil && decl.AsteriskToken != nil
	}
	return false
}

func subtreeContainsYield(node *shimast.Node) bool {
	if node == nil {
		return false
	}
	if node.Kind == shimast.KindYieldExpression {
		return true
	}
	if isFunctionLikeKind(node) && node.Parent != nil {
		return false
	}
	found := false
	node.ForEachChild(func(child *shimast.Node) bool {
		if subtreeContainsYield(child) {
			found = true
			return true
		}
		return false
	})
	return found
}

// vars-on-top: `var` declarations should appear at the top of their
// function/script scope.
type varsOnTop struct{}

func (varsOnTop) Name() string             { return "vars-on-top" }
func (varsOnTop) Visits() []shimast.Kind   { return []shimast.Kind{shimast.KindVariableStatement} }
func (varsOnTop) Check(ctx *Context, node *shimast.Node) {
	stmt := node.AsVariableStatement()
	if stmt == nil || stmt.DeclarationList == nil {
		return
	}
	if !shimast.IsVar(stmt.DeclarationList) {
		return
	}
	parent := node.Parent
	if parent == nil {
		return
	}
	switch parent.Kind {
	case shimast.KindSourceFile, shimast.KindModuleBlock:
	case shimast.KindBlock:
		grand := parent.Parent
		if grand == nil || !isFunctionLikeKind(grand) {
			ctx.Report(node, "All 'var' declarations must be at the top of the function scope.")
			return
		}
	default:
		ctx.Report(node, "All 'var' declarations must be at the top of the function scope.")
		return
	}
	// Same-block: must be the first non-trivial statement.
	siblings := parentStatements(parent)
	for _, sib := range siblings {
		if sib == node {
			return
		}
		if sib.Kind == shimast.KindVariableStatement {
			continue
		}
		ctx.Report(node, "All 'var' declarations must be at the top of the function scope.")
		return
	}
}

func parentStatements(parent *shimast.Node) []*shimast.Node {
	if parent == nil {
		return nil
	}
	switch parent.Kind {
	case shimast.KindBlock:
		block := parent.AsBlock()
		if block != nil && block.Statements != nil {
			return block.Statements.Nodes
		}
	case shimast.KindSourceFile:
		file := parent.AsSourceFile()
		if file != nil && file.Statements != nil {
			return file.Statements.Nodes
		}
	case shimast.KindModuleBlock:
		mb := parent.AsModuleBlock()
		if mb != nil && mb.Statements != nil {
			return mb.Statements.Nodes
		}
	}
	return nil
}

// yoda: `if (1 === x)` — ESLint flags literals on the left of a
// comparison as "yoda conditions". Default mode forbids them.
type yoda struct{}

func (yoda) Name() string             { return "yoda" }
func (yoda) Visits() []shimast.Kind   { return []shimast.Kind{shimast.KindBinaryExpression} }
func (yoda) Check(ctx *Context, node *shimast.Node) {
	expr := node.AsBinaryExpression()
	if expr == nil || expr.OperatorToken == nil {
		return
	}
	if !isComparisonOperator(expr.OperatorToken.Kind) {
		return
	}
	if isLiteralExpression(stripParens(expr.Left)) && !isLiteralExpression(stripParens(expr.Right)) {
		ctx.Report(node, "Expected literal to be on the right side of comparison.")
	}
}

func init() {
	Register(noAlert{})
	Register(noBitwise{})
	Register(noCaller{})
	Register(noCaseDeclarations{})
	Register(noContinue{})
	Register(noDeleteVar{})
	Register(noEqNull{})
	Register(noExtraBind{})
	Register(noLabels{})
	Register(noLoneBlocks{})
	Register(noLonelyIf{})
	Register(noMultiAssign{})
	Register(noNegatedCondition{})
	Register(noNestedTernary{})
	Register(noNew{})
	Register(noNewFunc{})
	Register(noObjectConstructor{})
	Register(noOctalEscape{})
	Register(noPlusPlus{})
	Register(noRegexSpaces{})
	Register(noReturnAssign{})
	Register(noSequences{})
	Register(noShadowRestrictedNames{})
	Register(noUndefined{})
	Register(noUnneededTernary{})
	Register(noUnusedExpressions{})
	Register(noUselessCall{})
	Register(noUselessComputedKey{})
	Register(noUselessRename{})
	Register(objectShorthand{})
	Register(operatorAssignment{})
	Register(preferExponentiationOperator{})
	Register(preferSpread{})
	Register(preferTemplate{})
	Register(requireYield{})
	Register(varsOnTop{})
	Register(yoda{})
}
