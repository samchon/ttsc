// unicorn/prefer-default-parameters reports a first-statement parameter
// assignment of the form `name = name ?? literal`. It is a style suggestion,
// not an equivalent rewrite: the assignment handles null and undefined,
// while a parameter default handles only undefined. Authors must decide
// whether changing the null policy is intended. No edit is supplied.
//
// AST-only: match a plain parameter name and literal fallback. Destructured
// parameters, || assignments and later statements are outside this baseline.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-default-parameters.md
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

type unicornPreferDefaultParameters struct{}

func (unicornPreferDefaultParameters) Name() string {
  return "unicorn/prefer-default-parameters"
}
func (unicornPreferDefaultParameters) Visits() []shimast.Kind {
  return []shimast.Kind{
    shimast.KindFunctionDeclaration,
    shimast.KindArrowFunction,
    shimast.KindFunctionExpression,
    shimast.KindMethodDeclaration,
  }
}
func (unicornPreferDefaultParameters) Check(ctx *Context, node *shimast.Node) {
  body := defaultParameterFunctionBody(node)
  if body == nil {
    return
  }
  if body.Statements == nil || len(body.Statements.Nodes) == 0 {
    return
  }
  first := body.Statements.Nodes[0]
  if first == nil || first.Kind != shimast.KindExpressionStatement {
    return
  }
  exprStmt := first.AsExpressionStatement()
  if exprStmt == nil || exprStmt.Expression == nil {
    return
  }
  expr := stripParens(exprStmt.Expression)
  if expr == nil || expr.Kind != shimast.KindBinaryExpression {
    return
  }
  assign := expr.AsBinaryExpression()
  if assign == nil || assign.OperatorToken == nil || assign.OperatorToken.Kind != shimast.KindEqualsToken {
    return
  }
  target := identifierText(stripParens(assign.Left))
  if target == "" {
    return
  }
  if !functionHasParameterNamed(node, target) {
    return
  }
  rhs := stripParens(assign.Right)
  if rhs == nil || rhs.Kind != shimast.KindBinaryExpression {
    return
  }
  coalesce := rhs.AsBinaryExpression()
  if coalesce == nil || coalesce.OperatorToken == nil ||
    coalesce.OperatorToken.Kind != shimast.KindQuestionQuestionToken {
    return
  }
  if identifierText(stripParens(coalesce.Left)) != target {
    return
  }
  if !isLiteralExpression(stripParens(coalesce.Right)) {
    return
  }
  ctx.Report(expr, "Prefer default parameters over `param = param ?? default` reassignments.")
}

// defaultParameterFunctionBody returns the BlockStatement body of a
// function-like node, or nil when the function has an expression body
// (arrow `=> expr`) or an overload signature without a body. The
// rule only fires on statement-level reassignments, so a body-less
// shape is a non-match by definition.
func defaultParameterFunctionBody(node *shimast.Node) *shimast.Block {
  if node == nil {
    return nil
  }
  var body *shimast.Node
  switch node.Kind {
  case shimast.KindFunctionDeclaration:
    if fn := node.AsFunctionDeclaration(); fn != nil {
      body = fn.Body
    }
  case shimast.KindFunctionExpression:
    if fn := node.AsFunctionExpression(); fn != nil {
      body = fn.Body
    }
  case shimast.KindArrowFunction:
    if fn := node.AsArrowFunction(); fn != nil {
      body = fn.Body
    }
  case shimast.KindMethodDeclaration:
    if fn := node.AsMethodDeclaration(); fn != nil {
      body = fn.Body
    }
  }
  if body == nil || body.Kind != shimast.KindBlock {
    return nil
  }
  return body.AsBlock()
}

// functionHasParameterNamed reports whether any parameter of the
// function-like node is a plain `Identifier` whose lexical text equals
// `name`. Destructured parameters are intentionally ignored — the rule
// cannot prove which inner binding a top-of-body reassignment refers to
// without semantic analysis.
func functionHasParameterNamed(node *shimast.Node, name string) bool {
  if node == nil || name == "" {
    return false
  }
  for _, p := range node.Parameters() {
    if p == nil {
      continue
    }
    decl := p.AsParameterDeclaration()
    if decl == nil {
      continue
    }
    if identifierText(decl.Name()) == name {
      return true
    }
  }
  return false
}

func init() {
  Register(unicornPreferDefaultParameters{})
}
