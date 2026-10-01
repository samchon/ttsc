// complexity: a function whose cyclomatic complexity exceeds the
// configured limit is almost always doing more than one job — every
// branching point doubles the number of paths a reader (and a test
// suite) has to keep in mind. ESLint's default is `{ max: 20 }`, which
// @ttsc/lint mirrors as the only built-in threshold (option-decoding is
// deferred). The metric starts at 1 for the function entry path and
// then adds 1 for each branching construct inside the body:
//   - `if` (each `else if` parses as a nested IfStatement, so it is
//     counted by the same arm),
//   - `case` clauses inside `switch`,
//   - `catch` clauses on `try`,
//   - ternary (`?:`) expressions,
//   - short-circuit operators `&&`, `||`, `??`.
//
// Nested function-likes start their own complexity counter and are
// visited independently, so an inner closure's branches do not
// inflate the outer function's score.
// https://eslint.org/docs/latest/rules/complexity
package linthost

import (
  "fmt"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// complexityLimit is the cyclomatic-complexity ceiling. Above this
// value the rule fires. Mirrors the ESLint default of 20.
const complexityLimit = 20

type complexity struct{}

func (complexity) Name() string { return "complexity" }
func (complexity) Visits() []shimast.Kind {
  return []shimast.Kind{
    shimast.KindFunctionDeclaration,
    shimast.KindFunctionExpression,
    shimast.KindArrowFunction,
    shimast.KindMethodDeclaration,
    shimast.KindGetAccessor,
    shimast.KindSetAccessor,
    shimast.KindConstructor,
  }
}
func (complexity) Check(ctx *Context, node *shimast.Node) {
  if node == nil {
    return
  }
  body := node.Body()
  if body == nil || body.Kind != shimast.KindBlock {
    return
  }
  score := 1
  walkComplexityBody(body, node, &score)
  if score > complexityLimit {
    ctx.Report(node, fmt.Sprintf("Function has a complexity of %d. Maximum allowed is %d.", score, complexityLimit))
  }
}

// walkComplexityBody descends through `root` adding 1 to `score` at
// every branching construct without crossing nested function-like
// scopes. Each nested function is left for its own visit.
func walkComplexityBody(node *shimast.Node, fn *shimast.Node, score *int) {
  if node == nil {
    return
  }
  if node != fn && isFunctionLikeKind(node) {
    return
  }
  switch node.Kind {
  case shimast.KindIfStatement,
    shimast.KindCaseClause,
    shimast.KindCatchClause,
    shimast.KindConditionalExpression:
    *score++
  case shimast.KindBinaryExpression:
    bin := node.AsBinaryExpression()
    if bin != nil && bin.OperatorToken != nil {
      switch bin.OperatorToken.Kind {
      case shimast.KindAmpersandAmpersandToken,
        shimast.KindBarBarToken,
        shimast.KindQuestionQuestionToken:
        *score++
      }
    }
  }
  node.ForEachChild(func(child *shimast.Node) bool {
    walkComplexityBody(child, fn, score)
    return false
  })
}

func init() {
  Register(complexity{})
}
