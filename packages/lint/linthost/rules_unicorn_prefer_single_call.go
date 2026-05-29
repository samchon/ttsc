// unicorn/prefer-single-call: `xs.push(1); xs.push(2);` repeats the
// `xs.push` lookup and the call dispatch for what is conceptually one
// "append these values" operation. Variadic methods like `push`,
// `unshift`, `addEventListener`, and `removeEventListener` accept
// multiple arguments specifically so authors can collapse the back-to-
// back form into a single call.
//
// AST-only: visit each `Block` AND `SourceFile`, scan the statement
// list for any pair of consecutive `ExpressionStatement`s whose
// expressions are `CallExpression`s targeting
// `PropertyAccess(<sameReceiverText>, <sameMethod>)` where the method
// is one of the variadic appenders. Receiver equivalence is decided
// by source-text comparison so chained receivers (e.g. `obj.list.push`)
// line up exactly. Report on the second statement so the diagnostic
// anchors to the redundant call.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-single-call.md
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

type unicornPreferSingleCall struct{}

func (unicornPreferSingleCall) Name() string { return "unicorn/prefer-single-call" }
func (unicornPreferSingleCall) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindBlock, shimast.KindSourceFile}
}
func (unicornPreferSingleCall) Check(ctx *Context, node *shimast.Node) {
  var stmts []*shimast.Node
  switch node.Kind {
  case shimast.KindBlock:
    block := node.AsBlock()
    if block == nil || block.Statements == nil {
      return
    }
    stmts = block.Statements.Nodes
  case shimast.KindSourceFile:
    file := node.AsSourceFile()
    if file == nil || file.Statements == nil {
      return
    }
    stmts = file.Statements.Nodes
  default:
    return
  }
  for i := 1; i < len(stmts); i++ {
    prevReceiver, prevMethod := unicornPreferSingleCallExtract(ctx, stmts[i-1])
    if prevReceiver == "" {
      continue
    }
    currReceiver, currMethod := unicornPreferSingleCallExtract(ctx, stmts[i])
    if currReceiver == "" {
      continue
    }
    if prevReceiver != currReceiver || prevMethod != currMethod {
      continue
    }
    ctx.Report(stmts[i], "Combine consecutive `"+currMethod+"` calls with multiple arguments into a single call.")
  }
}

// unicornPreferSingleCallExtract returns (receiverText, methodName) for a
// statement of the shape `<receiver>.<method>(…);` where `method` is one
// of the variadic appenders the rule targets. Returns ("", "") for any
// other shape.
func unicornPreferSingleCallExtract(ctx *Context, stmt *shimast.Node) (string, string) {
  if stmt == nil || stmt.Kind != shimast.KindExpressionStatement {
    return "", ""
  }
  exprStmt := stmt.AsExpressionStatement()
  if exprStmt == nil || exprStmt.Expression == nil {
    return "", ""
  }
  call := stripParens(exprStmt.Expression)
  if call == nil || call.Kind != shimast.KindCallExpression {
    return "", ""
  }
  c := call.AsCallExpression()
  if c == nil || c.Expression == nil || c.Expression.Kind != shimast.KindPropertyAccessExpression {
    return "", ""
  }
  access := c.Expression.AsPropertyAccessExpression()
  if access == nil || access.Expression == nil {
    return "", ""
  }
  method := identifierText(access.Name())
  switch method {
  case "push", "unshift", "addEventListener", "removeEventListener":
  default:
    return "", ""
  }
  return nodeText(ctx.File, access.Expression), method
}

func init() {
  Register(unicornPreferSingleCall{})
}
