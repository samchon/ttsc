// unicorn/prefer-ternary: when an `if`/`else` pair only differs in the
// value being returned (or, in the upstream rule, assigned), the
// equivalent `return cond ? a : b` is one line, removes the
// duplicated `return` keyword, and matches the shape of every other
// "pick one of two values" expression in the language.
//
// AST-only minimum-viable port: visit `IfStatement` and match only the
// return-statement case. Both then- and else-branches must each be a
// single `ReturnStatement` with a non-nil expression — either a bare
// `return …;` directly under the if, or a block wrapping exactly one
// such return. The assignment shape (`if (cond) x = a; else x = b;`)
// from the upstream rule is out of scope for this MVP; both call sites
// look syntactically symmetric, so adding the assignment branch later
// is a straightforward extension.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-ternary.md
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

type unicornPreferTernary struct{}

func (unicornPreferTernary) Name() string { return "unicorn/prefer-ternary" }
func (unicornPreferTernary) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindIfStatement}
}
func (unicornPreferTernary) Check(ctx *Context, node *shimast.Node) {
  stmt := node.AsIfStatement()
  if stmt == nil || stmt.ThenStatement == nil || stmt.ElseStatement == nil {
    return
  }
  // Reject `else if` — an `if`/`else if`/`else` ladder is a different
  // rewrite target (it becomes nested ternaries, which the upstream
  // rule explicitly does not require).
  if stmt.ElseStatement.Kind == shimast.KindIfStatement {
    return
  }
  if !unicornPreferTernaryIsSingleReturn(stmt.ThenStatement) {
    return
  }
  if !unicornPreferTernaryIsSingleReturn(stmt.ElseStatement) {
    return
  }
  ctx.Report(node, "Use a ternary instead of `if`/`else` whose branches differ only in the returned value.")
}

// unicornPreferTernaryIsSingleReturn reports whether `branch` is a
// single `return expr;` — either directly or wrapped in a one-statement
// block. Returns false for empty returns (`return;`); ternary cannot
// fold those because both arms have to produce a value.
func unicornPreferTernaryIsSingleReturn(branch *shimast.Node) bool {
  if branch == nil {
    return false
  }
  stmt := branch
  if branch.Kind == shimast.KindBlock {
    block := branch.AsBlock()
    if block == nil || block.Statements == nil || len(block.Statements.Nodes) != 1 {
      return false
    }
    stmt = block.Statements.Nodes[0]
  }
  if stmt == nil || stmt.Kind != shimast.KindReturnStatement {
    return false
  }
  ret := stmt.AsReturnStatement()
  return ret != nil && ret.Expression != nil
}

func init() {
  Register(unicornPreferTernary{})
}
