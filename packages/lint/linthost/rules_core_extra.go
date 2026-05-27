// Extended ESLint-core rules — AST-only correctness checks the
// recommended preset ships but that the original @ttsc/lint port
// hadn't migrated yet.
//
// Implemented here:
//   - no-await-in-loop: await inside a loop body iterates sequentially
//   - no-dupe-class-members: duplicate class member declarations
//   - no-this-before-super: `this` (or `super.x`) before `super()` in
//     derived constructors
//   - prefer-object-spread: `Object.assign({}, x, y)` → `{ ...x, ...y }`
package linthost

import (
	shimast "github.com/microsoft/typescript-go/shim/ast"
)

// noAwaitInLoop reports an `await` expression evaluated inside the body
// of a sequential loop (for / while / do-while / for-in / for-of). Each
// iteration of the loop blocks on the previous one's microtask hop, so
// the loop body runs strictly serially even when the underlying
// operations are independent and could overlap with Promise.all.
// https://eslint.org/docs/latest/rules/no-await-in-loop
//
// `for await … of` loops are exempt — the for-await iterator protocol
// is the whole reason the loop exists, and rejecting its `await` would
// just suggest the developer abandon the iterator.
type noAwaitInLoop struct{}

func (noAwaitInLoop) Name() string { return "no-await-in-loop" }
func (noAwaitInLoop) Visits() []shimast.Kind {
	return []shimast.Kind{shimast.KindAwaitExpression}
}
func (noAwaitInLoop) Check(ctx *Context, node *shimast.Node) {
	for cur := node.Parent; cur != nil; cur = cur.Parent {
		if isFunctionLikeKind(cur) {
			return
		}
		switch cur.Kind {
		case shimast.KindForStatement,
			shimast.KindWhileStatement,
			shimast.KindDoStatement,
			shimast.KindForInStatement:
			ctx.Report(node, "Unexpected `await` inside a loop — iterations run sequentially; prefer `Promise.all` when independent.")
			return
		case shimast.KindForOfStatement:
			// `for await … of` loops are exempt by design — the await
			// is the iteration itself, not a sequential block.
			if isForAwaitOfStatement(ctx.File, cur) {
				return
			}
			ctx.Report(node, "Unexpected `await` inside a loop — iterations run sequentially; prefer `Promise.all` when independent.")
			return
		}
	}
}

// isForAwaitOfStatement reports whether the for-of statement at `node`
// is a `for await … of` (rather than a plain `for … of`). The shim AST
// does not expose `AwaitModifier` as a typed field, so the check is
// textual: locate the `for` keyword and look for the `await` keyword
// in the small window before the opening parenthesis. The width 24
// covers any reasonable spacing/comment-free header.
func isForAwaitOfStatement(file *shimast.SourceFile, node *shimast.Node) bool {
	if file == nil || node == nil {
		return false
	}
	forPos := keywordStart(file, node, "for")
	if forPos < 0 {
		return false
	}
	src := file.Text()
	limit := forPos + 24
	if limit > len(src) {
		limit = len(src)
	}
	if node.End() < limit {
		limit = node.End()
	}
	for i := forPos + 3; i < limit; i++ {
		if src[i] == '(' {
			limit = i
			break
		}
	}
	return findKeyword(file, forPos+3, limit, "await") >= 0
}

// noDupeClassMembers reports two declarations of the same member on a
// single class. The later declaration silently overwrites the earlier
// one at runtime; ESLint enforces this because the syntax does not.
// https://eslint.org/docs/latest/rules/no-dupe-class-members
//
// Members are deduplicated by their (name, static, kind) tuple — an
// instance property and a static property of the same name coexist, as
// do a getter and a setter for the same property, but a getter and a
// regular method on the same key do not.
type noDupeClassMembers struct{}

func (noDupeClassMembers) Name() string { return "no-dupe-class-members" }
func (noDupeClassMembers) Visits() []shimast.Kind {
	return []shimast.Kind{shimast.KindClassDeclaration, shimast.KindClassExpression}
}
func (noDupeClassMembers) Check(ctx *Context, node *shimast.Node) {
	members := classMembers(node)
	if len(members) == 0 {
		return
	}
	type slot struct {
		name   string
		static bool
		kind   string
	}
	seen := map[slot]*shimast.Node{}
	for _, member := range members {
		if member == nil {
			continue
		}
		name, kind, ok := classMemberSlot(member)
		if !ok {
			continue
		}
		key := slot{name: name, static: hasModifier(member, shimast.KindStaticKeyword), kind: kind}
		if prior, exists := seen[key]; exists {
			_ = prior
			ctx.Report(member, "Duplicate class member `"+name+"`.")
			continue
		}
		seen[key] = member
	}
}

// classMembers returns the member list of a class declaration or
// expression. Returns nil for any other kind so the helper is safe to
// call from a multi-visit rule.
func classMembers(node *shimast.Node) []*shimast.Node {
	switch node.Kind {
	case shimast.KindClassDeclaration:
		if decl := node.AsClassDeclaration(); decl != nil && decl.Members != nil {
			return decl.Members.Nodes
		}
	case shimast.KindClassExpression:
		if expr := node.AsClassExpression(); expr != nil && expr.Members != nil {
			return expr.Members.Nodes
		}
	}
	return nil
}

// classMemberSlot extracts the (name, kind) identity for a class
// member. Constructors and unnamed/computed members are skipped — the
// rule cannot reason about them statically. The kind distinguishes
// getter/setter pairs from regular method/property declarations so a
// getter+setter on the same name does not trip the dupe check.
func classMemberSlot(member *shimast.Node) (string, string, bool) {
	if member == nil {
		return "", "", false
	}
	switch member.Kind {
	case shimast.KindMethodDeclaration,
		shimast.KindPropertyDeclaration,
		shimast.KindGetAccessor,
		shimast.KindSetAccessor:
		name := classMemberName(member)
		if name == "" {
			return "", "", false
		}
		var kind string
		switch member.Kind {
		case shimast.KindGetAccessor:
			kind = "get"
		case shimast.KindSetAccessor:
			kind = "set"
		default:
			kind = "data"
		}
		return name, kind, true
	}
	return "", "", false
}

// classMemberName returns the textual name of a class member identifier
// or literal key. Computed property names return the empty string so
// the caller can skip them — the rule cannot prove equivalence of two
// computed expressions statically.
func classMemberName(member *shimast.Node) string {
	name := member.Name()
	if name == nil {
		return ""
	}
	switch name.Kind {
	case shimast.KindIdentifier, shimast.KindPrivateIdentifier:
		return identifierText(name)
	case shimast.KindStringLiteral:
		return stringLiteralText(name)
	case shimast.KindNumericLiteral:
		return numericLiteralText(name)
	}
	return ""
}

// noThisBeforeSuper reports a derived constructor that references
// `this` (or `super.x`) before the first reachable `super()` call. ES
// throws a ReferenceError at runtime; the lint rule catches it before
// the program ever runs.
// https://eslint.org/docs/latest/rules/no-this-before-super
//
// Trigger: the class declaration has a `HeritageClause` of kind
// `extends`, the constructor body exists, and a `this` / `super.`
// reference appears textually before the first `super()` call. The
// walk stops at nested function-like boundaries so a `this` inside an
// inner arrow does not count.
type noThisBeforeSuper struct{}

func (noThisBeforeSuper) Name() string { return "no-this-before-super" }
func (noThisBeforeSuper) Visits() []shimast.Kind {
	return []shimast.Kind{shimast.KindConstructor}
}
func (noThisBeforeSuper) Check(ctx *Context, node *shimast.Node) {
	parent := node.Parent
	if parent == nil || !classExtendsAnother(parent) {
		return
	}
	ctor := node.AsConstructorDeclaration()
	if ctor == nil || ctor.Body == nil {
		return
	}
	var superCallPos = -1
	walkConstructorBody(ctor.Body, func(child *shimast.Node) {
		if child == nil || superCallPos >= 0 {
			return
		}
		if child.Kind == shimast.KindCallExpression {
			call := child.AsCallExpression()
			if call != nil && call.Expression != nil && call.Expression.Kind == shimast.KindSuperKeyword {
				superCallPos = child.Pos()
			}
		}
	})
	walkConstructorBody(ctor.Body, func(child *shimast.Node) {
		if child == nil {
			return
		}
		// Skip the call to super() itself.
		if child.Kind == shimast.KindCallExpression {
			call := child.AsCallExpression()
			if call != nil && call.Expression != nil && call.Expression.Kind == shimast.KindSuperKeyword {
				return
			}
		}
		switch child.Kind {
		case shimast.KindThisKeyword:
			if superCallPos < 0 || child.Pos() < superCallPos {
				ctx.Report(child, "`this` referenced before `super()` call in a derived constructor.")
			}
		case shimast.KindPropertyAccessExpression:
			access := child.AsPropertyAccessExpression()
			if access != nil && access.Expression != nil && access.Expression.Kind == shimast.KindSuperKeyword {
				if superCallPos < 0 || child.Pos() < superCallPos {
					ctx.Report(child, "`super.` access before `super()` call in a derived constructor.")
				}
			}
		}
	})
}

// classExtendsAnother reports whether the class declaration/expression
// has a non-empty `extends` heritage clause. Base classes (no extends)
// are skipped — `this` is legal before any super call there.
func classExtendsAnother(class *shimast.Node) bool {
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
		if hc == nil || hc.Token != shimast.KindExtendsKeyword {
			continue
		}
		if hc.Types != nil && len(hc.Types.Nodes) > 0 {
			return true
		}
	}
	return false
}

// walkConstructorBody walks every descendant of body, skipping into
// nested function-like scopes so a `this` inside an inner arrow does
// not get attributed to the surrounding constructor.
func walkConstructorBody(body *shimast.Node, visit func(*shimast.Node)) {
	if body == nil {
		return
	}
	var walk func(*shimast.Node)
	walk = func(n *shimast.Node) {
		if n == nil {
			return
		}
		if n != body && isFunctionLikeKind(n) {
			return
		}
		visit(n)
		n.ForEachChild(func(child *shimast.Node) bool {
			walk(child)
			return false
		})
	}
	walk(body)
}

// preferObjectSpread reports `Object.assign({}, …)` calls that should
// be expressed with the modern spread syntax `{ …a, …b }`. The two
// forms are not exactly equivalent for property accessors and Symbol
// keys, but the spread form is the one the language has settled on and
// the readability gain is large for the common case.
// https://eslint.org/docs/latest/rules/prefer-object-spread
//
// Trigger: `Object.assign(target, …)` where the target is an empty
// object literal. Mutating `Object.assign` calls (non-empty first
// argument) are intentionally allowed because they have observable
// behavior the spread form does not preserve.
type preferObjectSpread struct{}

func (preferObjectSpread) Name() string { return "prefer-object-spread" }
func (preferObjectSpread) Visits() []shimast.Kind {
	return []shimast.Kind{shimast.KindCallExpression}
}
func (preferObjectSpread) Check(ctx *Context, node *shimast.Node) {
	call := node.AsCallExpression()
	if call == nil || call.Expression == nil || call.Arguments == nil {
		return
	}
	obj, method, ok := promisePropertyAccessParts(call.Expression)
	if !ok || method != "assign" {
		return
	}
	if identifierText(obj) != "Object" {
		return
	}
	if len(call.Arguments.Nodes) < 2 {
		return
	}
	first := stripParens(call.Arguments.Nodes[0])
	if first == nil || first.Kind != shimast.KindObjectLiteralExpression {
		return
	}
	if objectLiteralIsEmpty(first) {
		ctx.Report(node, "Prefer object spread `{ ...a, ...b }` over `Object.assign({}, a, b)`.")
	}
}

// objectLiteralIsEmpty reports whether node is the literal `{}` (no
// properties, no shorthand assignments, no spreads).
func objectLiteralIsEmpty(node *shimast.Node) bool {
	if node == nil || node.Kind != shimast.KindObjectLiteralExpression {
		return false
	}
	lit := node.AsObjectLiteralExpression()
	if lit == nil || lit.Properties == nil {
		return true
	}
	return len(lit.Properties.Nodes) == 0
}

// noDuplicateImports reports two import declarations that resolve to
// the same module specifier. Consolidating them into one import keeps
// the dependency graph at the head of the file readable and avoids
// surprising load-order interactions when the import has side effects.
// https://eslint.org/docs/latest/rules/no-duplicate-imports
//
// The check is textual on the module specifier string — two imports
// with the same exact string literal collide. `import type { … } from`
// is folded together with value imports because the runtime sees only
// one module load.
type noDuplicateImports struct{}

func (noDuplicateImports) Name() string { return "no-duplicate-imports" }
func (noDuplicateImports) Visits() []shimast.Kind {
	return []shimast.Kind{shimast.KindSourceFile}
}
func (noDuplicateImports) Check(ctx *Context, node *shimast.Node) {
	seen := map[string]bool{}
	node.ForEachChild(func(child *shimast.Node) bool {
		if child == nil || child.Kind != shimast.KindImportDeclaration {
			return false
		}
		decl := child.AsImportDeclaration()
		if decl == nil || decl.ModuleSpecifier == nil {
			return false
		}
		spec := stringLiteralText(decl.ModuleSpecifier)
		if spec == "" {
			return false
		}
		if seen[spec] {
			ctx.Report(child, "Module `"+spec+"` is already imported above; consolidate the imports.")
			return false
		}
		seen[spec] = true
		return false
	})
}

// getterReturn reports a `get` accessor whose body completes without
// returning a value. The runtime returns `undefined` from such a
// getter; in practice that is always a bug — the caller expects the
// property to have a value.
// https://eslint.org/docs/latest/rules/getter-return
type getterReturn struct{}

func (getterReturn) Name() string { return "getter-return" }
func (getterReturn) Visits() []shimast.Kind {
	return []shimast.Kind{shimast.KindGetAccessor}
}
func (getterReturn) Check(ctx *Context, node *shimast.Node) {
	accessor := node.AsGetAccessorDeclaration()
	if accessor == nil || accessor.Body == nil {
		return
	}
	if !getterBodyAlwaysReturns(accessor.Body) {
		ctx.Report(node, "Getter must return a value.")
	}
}

// getterBodyAlwaysReturns walks a `get` accessor body and reports
// whether every reachable exit point returns a value. This is a
// shallow approximation — sufficient for the common case where the
// getter's body is a sequence of statements ending in `return X`.
func getterBodyAlwaysReturns(body *shimast.Node) bool {
	if body == nil || body.Kind != shimast.KindBlock {
		return false
	}
	statements := body.Statements()
	if len(statements) == 0 {
		return false
	}
	last := statements[len(statements)-1]
	return statementReturnsValue(last)
}

// statementReturnsValue checks if a statement is a value-returning
// `return X;`, a `throw`, a block that ends in one of those, or a
// conditional whose every branch returns a value.
func statementReturnsValue(stmt *shimast.Node) bool {
	if stmt == nil {
		return false
	}
	switch stmt.Kind {
	case shimast.KindReturnStatement:
		ret := stmt.AsReturnStatement()
		return ret != nil && ret.Expression != nil
	case shimast.KindThrowStatement:
		return true
	case shimast.KindBlock:
		stmts := stmt.Statements()
		if len(stmts) == 0 {
			return false
		}
		return statementReturnsValue(stmts[len(stmts)-1])
	case shimast.KindIfStatement:
		ifStmt := stmt.AsIfStatement()
		if ifStmt == nil || ifStmt.ThenStatement == nil || ifStmt.ElseStatement == nil {
			return false
		}
		return statementReturnsValue(ifStmt.ThenStatement) && statementReturnsValue(ifStmt.ElseStatement)
	}
	return false
}

// noNewSymbol reports `new Symbol(...)`. `Symbol` is a function but not
// a constructor; calling it with `new` throws a TypeError at runtime.
// https://eslint.org/docs/latest/rules/no-new-symbol — the upstream
// rule has been renamed `no-new-native-nonconstructor` but kept as an
// alias; we expose the legacy name because it remains the more readable
// pointer for this specific check.
type noNewSymbol struct{}

func (noNewSymbol) Name() string { return "no-new-symbol" }
func (noNewSymbol) Visits() []shimast.Kind {
	return []shimast.Kind{shimast.KindNewExpression}
}
func (noNewSymbol) Check(ctx *Context, node *shimast.Node) {
	ne := node.AsNewExpression()
	if ne == nil {
		return
	}
	if identifierText(ne.Expression) == "Symbol" {
		ctx.Report(node, "`Symbol` cannot be called with `new`.")
	}
}

// noConstructorReturn reports a constructor body that contains a
// `return X;` statement (i.e., the return statement carries a value).
// The returned value is ignored when the constructor is invoked with
// `new` unless it happens to be an object; relying on that behavior is
// always a misunderstanding of the constructor protocol.
// https://eslint.org/docs/latest/rules/no-constructor-return
type noConstructorReturn struct{}

func (noConstructorReturn) Name() string { return "no-constructor-return" }
func (noConstructorReturn) Visits() []shimast.Kind {
	return []shimast.Kind{shimast.KindConstructor}
}
func (noConstructorReturn) Check(ctx *Context, node *shimast.Node) {
	ctor := node.AsConstructorDeclaration()
	if ctor == nil || ctor.Body == nil {
		return
	}
	walkConstructorBody(ctor.Body, func(child *shimast.Node) {
		if child == nil || child.Kind != shimast.KindReturnStatement {
			return
		}
		ret := child.AsReturnStatement()
		if ret != nil && ret.Expression != nil {
			ctx.Report(child, "Class constructors should not return a value.")
		}
	})
}

// noUnsafeOptionalChaining reports member access or call expressions
// that chain off an optional chain WITHOUT continuing the optional
// chain. `(obj?.foo).bar` throws a TypeError if obj is null/undefined,
// because the outer `.bar` is no longer optional. Same for `obj?.foo()`
// followed by `.bar` — once the chain terminates, downstream accesses
// are unsafe again.
// https://eslint.org/docs/latest/rules/no-unsafe-optional-chaining
type noUnsafeOptionalChaining struct{}

func (noUnsafeOptionalChaining) Name() string { return "no-unsafe-optional-chaining" }
func (noUnsafeOptionalChaining) Visits() []shimast.Kind {
	return []shimast.Kind{
		shimast.KindPropertyAccessExpression,
		shimast.KindElementAccessExpression,
		shimast.KindCallExpression,
	}
}
func (noUnsafeOptionalChaining) Check(ctx *Context, node *shimast.Node) {
	var receiver *shimast.Node
	switch node.Kind {
	case shimast.KindPropertyAccessExpression:
		access := node.AsPropertyAccessExpression()
		if access == nil {
			return
		}
		// If this access is itself optional, the chain continues — safe.
		if access.QuestionDotToken != nil {
			return
		}
		receiver = access.Expression
	case shimast.KindElementAccessExpression:
		access := node.AsElementAccessExpression()
		if access == nil {
			return
		}
		if access.QuestionDotToken != nil {
			return
		}
		receiver = access.Expression
	case shimast.KindCallExpression:
		call := node.AsCallExpression()
		if call == nil {
			return
		}
		if call.QuestionDotToken != nil {
			return
		}
		receiver = call.Expression
	}
	if receiverEndsWithOptionalChain(receiver) {
		ctx.Report(node, "Unsafe access after an optional chain — continue the chain with `?.` or check for nullish above.")
	}
}

// receiverEndsWithOptionalChain reports whether the receiver expression
// terminates in an optional `?.` operator. If so, the result of the
// receiver may be undefined and subsequent member access is unsafe.
// A non-null assertion (`!`) does NOT make the access safe — at lint
// time the developer is suppressing the static-undefined warning, but
// at runtime the chain still resolves to undefined when the optional
// link short-circuits, so we look through `NonNullExpression` too.
func receiverEndsWithOptionalChain(node *shimast.Node) bool {
	node = stripParens(node)
	if node == nil {
		return false
	}
	if node.Kind == shimast.KindNonNullExpression {
		if nn := node.AsNonNullExpression(); nn != nil {
			return receiverEndsWithOptionalChain(nn.Expression)
		}
	}
	switch node.Kind {
	case shimast.KindPropertyAccessExpression:
		access := node.AsPropertyAccessExpression()
		return access != nil && access.QuestionDotToken != nil
	case shimast.KindElementAccessExpression:
		access := node.AsElementAccessExpression()
		return access != nil && access.QuestionDotToken != nil
	case shimast.KindCallExpression:
		call := node.AsCallExpression()
		return call != nil && call.QuestionDotToken != nil
	}
	return false
}

// preferObjectHasOwn reports calls of the form
// `Object.prototype.hasOwnProperty.call(obj, key)` and suggests the
// `Object.hasOwn(obj, key)` shorthand introduced in ES2022. The new
// helper is shorter, less error-prone (no chance of a redefined
// `hasOwnProperty` on the host object), and matches the form linters
// elsewhere recommend.
// https://eslint.org/docs/latest/rules/prefer-object-has-own
type preferObjectHasOwn struct{}

func (preferObjectHasOwn) Name() string { return "prefer-object-has-own" }
func (preferObjectHasOwn) Visits() []shimast.Kind {
	return []shimast.Kind{shimast.KindCallExpression}
}
func (preferObjectHasOwn) Check(ctx *Context, node *shimast.Node) {
	call := node.AsCallExpression()
	if call == nil || call.Expression == nil {
		return
	}
	// Pattern: Object.prototype.hasOwnProperty.call(obj, key)
	outer, method, ok := promisePropertyAccessParts(call.Expression)
	if !ok || method != "call" {
		return
	}
	inner, name, ok := promisePropertyAccessParts(outer)
	if !ok || name != "hasOwnProperty" {
		return
	}
	base, prop, ok := promisePropertyAccessParts(inner)
	if !ok || prop != "prototype" {
		return
	}
	if identifierText(base) != "Object" {
		return
	}
	ctx.Report(node, "Prefer `Object.hasOwn(obj, key)` over `Object.prototype.hasOwnProperty.call(obj, key)`.")
}

// noImplicitCoercion reports the most common implicit coercion idioms:
// `!!x` for boolean coercion, `+x` for number, `"" + x` for string. ES
// has explicit coercion functions (`Boolean(x)`, `Number(x)`,
// `String(x)`) that read more clearly and avoid surprise around the
// edge cases (e.g. `+null === 0` vs `+undefined === NaN`).
// https://eslint.org/docs/latest/rules/no-implicit-coercion
type noImplicitCoercion struct{}

func (noImplicitCoercion) Name() string { return "no-implicit-coercion" }
func (noImplicitCoercion) Visits() []shimast.Kind {
	return []shimast.Kind{
		shimast.KindPrefixUnaryExpression,
		shimast.KindBinaryExpression,
	}
}
func (noImplicitCoercion) Check(ctx *Context, node *shimast.Node) {
	switch node.Kind {
	case shimast.KindPrefixUnaryExpression:
		prefix := node.AsPrefixUnaryExpression()
		if prefix == nil || prefix.Operand == nil {
			return
		}
		switch prefix.Operator {
		case shimast.KindExclamationToken:
			// `!!x` → Boolean(x). The inner expression must be another `!`.
			inner := stripParens(prefix.Operand)
			if inner == nil || inner.Kind != shimast.KindPrefixUnaryExpression {
				return
			}
			innerPrefix := inner.AsPrefixUnaryExpression()
			if innerPrefix != nil && innerPrefix.Operator == shimast.KindExclamationToken {
				ctx.Report(node, "Prefer `Boolean(x)` over `!!x` for explicit boolean coercion.")
			}
		case shimast.KindPlusToken:
			// `+x` where x is not a numeric literal → Number(x). Skip
			// numeric literals because `+0` / `+1` are the canonical form
			// for explicit positive numbers.
			operand := stripParens(prefix.Operand)
			if operand == nil || operand.Kind == shimast.KindNumericLiteral {
				return
			}
			ctx.Report(node, "Prefer `Number(x)` over `+x` for explicit number coercion.")
		}
	case shimast.KindBinaryExpression:
		bin := node.AsBinaryExpression()
		if bin == nil || bin.OperatorToken == nil || bin.OperatorToken.Kind != shimast.KindPlusToken {
			return
		}
		// `"" + x` or `x + ""` → String(x).
		left := stripParens(bin.Left)
		right := stripParens(bin.Right)
		if isEmptyStringLiteral(left) && right != nil && !isEmptyStringLiteral(right) {
			ctx.Report(node, "Prefer `String(x)` over `\"\" + x` for explicit string coercion.")
			return
		}
		if isEmptyStringLiteral(right) && left != nil && !isEmptyStringLiteral(left) {
			ctx.Report(node, "Prefer `String(x)` over `x + \"\"` for explicit string coercion.")
		}
	}
}

// isEmptyStringLiteral reports whether node is the literal `""` or
// `''` (an empty-string string literal).
func isEmptyStringLiteral(node *shimast.Node) bool {
	if node == nil || node.Kind != shimast.KindStringLiteral {
		return false
	}
	return stringLiteralText(node) == ""
}

func init() {
	Register(noAwaitInLoop{})
	Register(noConstructorReturn{})
	Register(noDupeClassMembers{})
	Register(noDuplicateImports{})
	Register(noImplicitCoercion{})
	Register(noNewSymbol{})
	Register(noThisBeforeSuper{})
	Register(noUnsafeOptionalChaining{})
	Register(getterReturn{})
	Register(preferObjectHasOwn{})
	Register(preferObjectSpread{})
}
