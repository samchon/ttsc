// maxStatements: a function whose body contains too many statements is
// almost always doing more than one job. Splitting it into smaller
// helpers usually improves both readability and testability. ESLint's
// default is `{ max: 10 }`, which @ttsc/lint mirrors as the only
// built-in threshold (option-decoding is deferred). Only the function's
// own block-body statement list is counted — nested function-like
// declarations contribute exactly one statement (themselves) regardless
// of how many statements they internally contain.
// https://eslint.org/docs/latest/rules/max-statements
package linthost

import (
  "fmt"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// maxStatementsLimit is the statement-count ceiling. Above this value
// the rule fires. Mirrors the ESLint default and matches the threshold
// documented in the README and website MDX.
const maxStatementsLimit = 10

type maxStatements struct{}

func (maxStatements) Name() string { return "max-statements" }
func (maxStatements) Visits() []shimast.Kind {
  return []shimast.Kind{
    shimast.KindFunctionDeclaration,
    shimast.KindFunctionExpression,
    shimast.KindArrowFunction,
    shimast.KindMethodDeclaration,
  }
}
func (maxStatements) Check(ctx *Context, node *shimast.Node) {
  if node == nil {
    return
  }
  body := node.Body()
  if body == nil || body.Kind != shimast.KindBlock {
    return
  }
  block := body.AsBlock()
  if block == nil || block.Statements == nil {
    return
  }
  count := 0
  for _, stmt := range block.Statements.Nodes {
    if stmt != nil {
      count++
    }
  }
  if count > maxStatementsLimit {
    ctx.Report(node, fmt.Sprintf("Function has too many statements (%d). Maximum allowed is %d.", count, maxStatementsLimit))
  }
}

func init() {
  Register(maxStatements{})
}
