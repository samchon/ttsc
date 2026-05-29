// defaultCase: a `switch` statement that omits the `default` clause
// silently drops every discriminant value not matched by an explicit
// `case` label. The rule wants the catch-all path written out so an
// unhandled discriminant becomes an intentional branch — even if that
// branch is a `// no default` comment marker.
//
// AST-only: each visited `SwitchStatement` checks its `CaseBlock`
// clauses for any node of kind `DefaultClause`. The rule reports on the
// switch keyword itself rather than the case block so the diagnostic
// lands at the head of the statement.
// https://eslint.org/docs/latest/rules/default-case
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

type defaultCase struct{}

func (defaultCase) Name() string           { return "default-case" }
func (defaultCase) Visits() []shimast.Kind { return []shimast.Kind{shimast.KindSwitchStatement} }
func (defaultCase) Check(ctx *Context, node *shimast.Node) {
  sw := node.AsSwitchStatement()
  if sw == nil || sw.CaseBlock == nil {
    return
  }
  block := sw.CaseBlock.AsCaseBlock()
  if block == nil || block.Clauses == nil {
    return
  }
  for _, clause := range block.Clauses.Nodes {
    if clause != nil && clause.Kind == shimast.KindDefaultClause {
      return
    }
  }
  ctx.Report(node, "Expected a default case.")
}

func init() {
  Register(defaultCase{})
}
