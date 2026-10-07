// Extended ESLint-core rules — AST-only correctness checks the
// recommended preset ships but that the original @ttsc/lint port
// hadn't migrated yet.
//
// Implemented here:
//   - no-await-in-loop: explicit or implicit await in a repeated loop position
//   - no-dupe-class-members: duplicate class member declarations
//   - no-this-before-super: `this` (or `super.x`) before `super()` in
//     derived constructors
//   - prefer-object-spread: `Object.assign({}, x, y)` → `{ ...x, ...y }`
package linthost

import (
  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// noAwaitInLoop reports explicit and implicit awaits evaluated in a repeated
// loop position. Initializers and iterable expressions run only once per loop,
// while tests, updates, bodies, nested for-await statements, and await-using
// declarations in repeated positions serialize iterations.
// https://eslint.org/docs/latest/rules/no-await-in-loop
type noAwaitInLoop struct{}

func (noAwaitInLoop) Name() string { return "no-await-in-loop" }
func (noAwaitInLoop) Visits() []shimast.Kind {
  return []shimast.Kind{
    shimast.KindAwaitExpression,
    shimast.KindForOfStatement,
    shimast.KindVariableDeclarationList,
  }
}
func (noAwaitInLoop) Check(ctx *Context, node *shimast.Node) {
  if node == nil || !isAwaitInLoopCandidate(node) {
    return
  }
  child := node
  for parent := node.Parent; parent != nil && !isAwaitInLoopBoundary(parent); parent = parent.Parent {
    if isRepeatedLoopPosition(child, parent) {
      ctx.Report(node, "Unexpected `await` inside a loop — iterations run sequentially; prefer `Promise.all` when independent.")
      return
    }
    child = parent
  }
}

func isAwaitInLoopCandidate(node *shimast.Node) bool {
  switch node.Kind {
  case shimast.KindAwaitExpression:
    return true
  case shimast.KindForOfStatement:
    statement := node.AsForInOrOfStatement()
    return statement != nil && statement.AwaitModifier != nil
  case shimast.KindVariableDeclarationList:
    return isAwaitUsingDeclarationList(node)
  default:
    return false
  }
}

func isAwaitInLoopBoundary(node *shimast.Node) bool {
  if isFunctionLikeKind(node) {
    return true
  }
  if node == nil || node.Kind != shimast.KindForOfStatement {
    return false
  }
  statement := node.AsForInOrOfStatement()
  return statement != nil && statement.AwaitModifier != nil
}

func isRepeatedLoopPosition(child, parent *shimast.Node) bool {
  switch parent.Kind {
  case shimast.KindForStatement:
    statement := parent.AsForStatement()
    return statement != nil &&
      (child == statement.Condition || child == statement.Incrementor || child == statement.Statement)
  case shimast.KindForInStatement, shimast.KindForOfStatement:
    statement := parent.AsForInOrOfStatement()
    return statement != nil &&
      (child == statement.Statement ||
        (child == statement.Initializer && isAwaitUsingDeclarationList(child)))
  case shimast.KindWhileStatement:
    statement := parent.AsWhileStatement()
    return statement != nil && (child == statement.Expression || child == statement.Statement)
  case shimast.KindDoStatement:
    statement := parent.AsDoStatement()
    return statement != nil && (child == statement.Expression || child == statement.Statement)
  default:
    return false
  }
}

func isAwaitUsingDeclarationList(node *shimast.Node) bool {
  return node != nil && node.Kind == shimast.KindVariableDeclarationList &&
    shimast.GetCombinedNodeFlags(node)&shimast.NodeFlagsBlockScoped == shimast.NodeFlagsAwaitUsing
}

// noDupeClassMembers reports two declarations of the same member on a
// single class. The later declaration silently overwrites the earlier
// one at runtime; ESLint enforces this because the syntax does not.
// https://eslint.org/docs/latest/rules/no-dupe-class-members
//
// Members are deduplicated by their (name, static) identity: an
// instance property and a static property of the same name coexist, as
// do a getter and a setter for the same property, but a getter and a
// regular method on the same key do not. Bodiless method declarations are
// TypeScript overload signatures and are not counted.
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
  }
  seen := map[slot]map[string]bool{}
  for _, member := range members {
    if member == nil {
      continue
    }
    // A bodiless method is an overload signature (or an abstract or ambient
    // declaration). Overload sets legitimately repeat one name before their
    // single implementation, so only members with a body take part.
    if member.Kind == shimast.KindMethodDeclaration && member.Body() == nil {
      continue
    }
    name, kind, ok := classMemberSlot(member)
    if !ok {
      continue
    }
    key := slot{name: name, static: hasModifier(member, shimast.KindStaticKeyword)}
    kinds := seen[key]
    if kinds == nil {
      kinds = map[string]bool{}
      seen[key] = kinds
    }
    if kinds[kind] || kinds["data"] || kind == "data" && len(kinds) > 0 {
      ctx.Report(member, "Duplicate class member `"+name+"`.")
    }
    kinds[kind] = true
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
  if !statementCannotComplete(accessor.Body, true) {
    ctx.Report(node, "Getter must return a value.")
  }
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

// noUnsafeOptionalChaining reports access or calls after a parenthesized
// optional chain. Contiguous chains such as obj?.foo().bar short-circuit
// together; parentheses end that protection, as in (obj?.foo()).bar.
// Erased TypeScript assertions do not protect an undefined receiver at runtime.
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
  // Parser propagation marks every contiguous optional-chain segment, even
  // segments without their own question-dot token. Parentheses end it.
  if node.Flags&shimast.NodeFlagsOptionalChain != 0 {
    return
  }
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

// receiverEndsWithOptionalChain recognizes any segment marked by the parser
// as optional-chain continuation, including ordinary links after the first
// question-dot. Parentheses and erased TypeScript assertions are transparent
// to the receiver's undefined result after its chain terminates.
func receiverEndsWithOptionalChain(node *shimast.Node) bool {
  node = unwrapReferenceExpression(node)
  if node == nil {
    return false
  }
  switch node.Kind {
  case shimast.KindPropertyAccessExpression:
    access := node.AsPropertyAccessExpression()
    return access != nil && node.Flags&shimast.NodeFlagsOptionalChain != 0
  case shimast.KindElementAccessExpression:
    access := node.AsElementAccessExpression()
    return access != nil && node.Flags&shimast.NodeFlagsOptionalChain != 0
  case shimast.KindCallExpression:
    call := node.AsCallExpression()
    return call != nil && node.Flags&shimast.NodeFlagsOptionalChain != 0
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

// noImplicitCoercion expresses a preference for named conversions over !!x,
// +x and empty-string concatenation. It supplies no automatic edits and does
// not prove equivalent coercion: Number accepts BigInt while unary + throws,
// and String uses a string primitive hint instead of concatenation's default
// hint. Authors must choose the conversion whose behavior they intend.
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
// `”` (an empty-string string literal).
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
  Register(noImplicitCoercion{})
  Register(noNewSymbol{})
  Register(noThisBeforeSuper{})
  Register(noUnsafeOptionalChaining{})
  Register(getterReturn{})
  Register(preferObjectHasOwn{})
  Register(preferObjectSpread{})
}
