// defaultCaseLast: a `switch` statement whose `default` clause is not
// the final clause changes fall-through semantics in a way that almost
// never matches the author's intent — running `default` then falling
// into `case "b"` is rarely what a misordered switch wants. The rule
// requires `default` to appear after every `case` label.
//
// AST-only: each visited `SwitchStatement` walks its `CaseBlock`
// clauses, and any `DefaultClause` that is not the last element is
// reported on the clause itself.
// https://eslint.org/docs/latest/rules/default-case-last
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

type defaultCaseLast struct{}

func (defaultCaseLast) Name() string { return "default-case-last" }
func (defaultCaseLast) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindSwitchStatement}
}
func (defaultCaseLast) Check(ctx *Context, node *shimast.Node) {
  sw := node.AsSwitchStatement()
  if sw == nil || sw.CaseBlock == nil {
    return
  }
  block := sw.CaseBlock.AsCaseBlock()
  if block == nil || block.Clauses == nil {
    return
  }
  clauses := block.Clauses.Nodes
  if len(clauses) == 0 {
    return
  }
  last := clauses[len(clauses)-1]
  for i := 0; i < len(clauses)-1; i++ {
    clause := clauses[i]
    if clause != nil && clause.Kind == shimast.KindDefaultClause {
      _ = last
      ctx.Report(clause, "Default clause should be the last clause.")
    }
  }
}

func init() {
  Register(defaultCaseLast{})
}
