// guardForIn: `for (key in obj)` walks the prototype chain and yields
// every enumerable name, inherited or own. Most authors only ever care
// about own keys, so an unguarded body silently leaks work onto
// prototype-chain entries someone else attached. The canonical guard is
// `if (Object.hasOwn(obj, key))` or the older
// `Object.prototype.hasOwnProperty.call(obj, key)`; an inverted-guard
// `continue` (`if (!Object.hasOwn(...)) continue;`) is the equivalent
// early-skip shape.
//
// Conservative baseline: the rule only inspects the FIRST executable
// statement of the loop body. The body either opens with a guard
// covering everything that follows, or it does not — anything more
// nuanced is the developer's responsibility. The guard expression must
// reference the loop's own key binding; a hard-coded call on an
// unrelated identifier is not a real guard.
// https://eslint.org/docs/latest/rules/guard-for-in
package linthost

import (
  shimast "github.com/microsoft/typescript-go/shim/ast"
)

type guardForIn struct{}

func (guardForIn) Name() string           { return "guard-for-in" }
func (guardForIn) Visits() []shimast.Kind { return []shimast.Kind{shimast.KindForInStatement} }
func (guardForIn) Check(ctx *Context, node *shimast.Node) {
  stmt := node.AsForInOrOfStatement()
  if stmt == nil || stmt.Statement == nil {
    return
  }
  first := firstBodyStatement(stmt.Statement)
  if first == nil {
    return
  }
  key := forInKeyName(stmt.Initializer)
  if isHasOwnGuard(first, key) {
    return
  }
  ctx.Report(node, "The body of a `for...in` should be wrapped in an `if (Object.hasOwn(...))` statement to filter unwanted properties from the prototype.")
}

// firstBodyStatement returns the first executable statement inside a
// loop body. A block body unwraps to its first statement; a bare
// non-block body is itself the only statement. Returns nil for an
// empty block — an empty body cannot leak inherited keys.
func firstBodyStatement(body *shimast.Node) *shimast.Node {
  if body == nil {
    return nil
  }
  if body.Kind != shimast.KindBlock {
    return body
  }
  block := body.AsBlock()
  if block == nil || block.Statements == nil {
    return nil
  }
  for _, s := range block.Statements.Nodes {
    if s != nil {
      return s
    }
  }
  return nil
}

// forInKeyName extracts the identifier text of the loop key from a
// `for (… in obj)` initializer. The initializer is either a
// VariableDeclarationList with one declaration (`for (const key in …)`)
// or a bare Identifier (`for (key in …)`). Destructuring patterns and
// other shapes return "" so the rule skips its key-identity check.
func forInKeyName(init *shimast.Node) string {
  if init == nil {
    return ""
  }
  if name := identifierText(init); name != "" {
    return name
  }
  if init.Kind != shimast.KindVariableDeclarationList {
    return ""
  }
  list := init.AsVariableDeclarationList()
  if list == nil || list.Declarations == nil || len(list.Declarations.Nodes) != 1 {
    return ""
  }
  decl := list.Declarations.Nodes[0]
  if decl == nil {
    return ""
  }
  v := decl.AsVariableDeclaration()
  if v == nil {
    return ""
  }
  return identifierText(v.Name())
}

// isHasOwnGuard reports whether `stmt` is the canonical own-key guard
// that should open a `for...in` body. Two shapes count:
//
//  1. `if (<has-own>(obj, key)) { … }` — positive guard wrapping the
//     real body. The else branch (if any) is allowed because the
//     developer has explicitly handled the inherited-key case.
//  2. `if (!<has-own>(obj, key)) continue;` — inverted-guard early
//     skip. The then branch must be a single `continue` (with or
//     without a block wrapper) so the rest of the loop body only runs
//     for own keys.
//
// `<has-own>` is either `Object.hasOwn(obj, key)` or
// `Object.prototype.hasOwnProperty.call(obj, key)`. The second
// argument must match `key` when one was extracted from the
// initializer; otherwise any second argument is accepted (the rule
// has no reliable handle on the key name).
func isHasOwnGuard(stmt *shimast.Node, key string) bool {
  if stmt == nil || stmt.Kind != shimast.KindIfStatement {
    return false
  }
  ifStmt := stmt.AsIfStatement()
  if ifStmt == nil || ifStmt.Expression == nil {
    return false
  }
  cond := stripParens(ifStmt.Expression)
  if cond == nil {
    return false
  }
  if isHasOwnCall(cond, key) {
    return true
  }
  if cond.Kind != shimast.KindPrefixUnaryExpression {
    return false
  }
  pre := cond.AsPrefixUnaryExpression()
  if pre == nil || pre.Operator != shimast.KindExclamationToken {
    return false
  }
  if !isHasOwnCall(stripParens(pre.Operand), key) {
    return false
  }
  // Negated guard: require the then branch to be a single `continue`
  // so the rest of the loop runs only for own keys.
  return isLoneContinue(ifStmt.ThenStatement)
}

// isHasOwnCall reports whether `node` is `Object.hasOwn(obj, key)` or
// `Object.prototype.hasOwnProperty.call(obj, key)`. The second
// argument must match `key` when one is supplied.
func isHasOwnCall(node *shimast.Node, key string) bool {
  if node == nil || node.Kind != shimast.KindCallExpression {
    return false
  }
  call := node.AsCallExpression()
  if call == nil || call.Expression == nil || call.Arguments == nil {
    return false
  }
  args := call.Arguments.Nodes
  if len(args) < 2 {
    return false
  }
  callee := stripParens(call.Expression)
  switch {
  case isMatchingPropertyAccess(callee, "Object", "hasOwn"):
    // `Object.hasOwn(obj, key)` — both arguments belong to the
    // caller; the key check is the second argument.
  case isMatchingPropertyAccess(callee, "Object", "prototype", "hasOwnProperty", "call"):
    // `Object.prototype.hasOwnProperty.call(obj, key)` — same
    // argument layout because `.call(obj, key)` passes the
    // receiver explicitly.
  default:
    return false
  }
  if key == "" {
    return true
  }
  return identifierText(stripParens(args[1])) == key
}

// isLoneContinue reports whether `stmt` is a bare `continue;` (or a
// block containing exactly one `continue;`). Used to validate the
// then-branch of the negated-guard shape.
func isLoneContinue(stmt *shimast.Node) bool {
  if stmt == nil {
    return false
  }
  if stmt.Kind == shimast.KindContinueStatement {
    return true
  }
  if stmt.Kind != shimast.KindBlock {
    return false
  }
  block := stmt.AsBlock()
  if block == nil || block.Statements == nil || len(block.Statements.Nodes) != 1 {
    return false
  }
  return block.Statements.Nodes[0] != nil &&
    block.Statements.Nodes[0].Kind == shimast.KindContinueStatement
}

func init() {
  Register(guardForIn{})
}
