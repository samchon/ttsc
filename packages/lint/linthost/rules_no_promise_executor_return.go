// noPromiseExecutorReturn rejects values returned by the callback passed as
// the first argument to the global Promise constructor. Promise ignores its
// executor's return value, so a value return almost always reflects a missing
// resolve/reject call or an accidentally concise arrow body.
//
// The rule uses checker binding identity rather than identifier text: a local
// class, variable, import, or parameter named Promise is a different
// constructor and remains untouched. It walks every statement nested inside
// the executor, but stops at nested function-like boundaries so those
// functions retain their own return scopes.
// https://eslint.org/docs/latest/rules/no-promise-executor-return
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

const noPromiseExecutorReturnMessage = "Return values from promise executor functions cannot be read."

type noPromiseExecutorReturn struct{}

type noPromiseExecutorReturnOptions struct {
  AllowVoid bool `json:"allowVoid"`
}

func (noPromiseExecutorReturn) Name() string { return "no-promise-executor-return" }
func (noPromiseExecutorReturn) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindNewExpression}
}
func (noPromiseExecutorReturn) NeedsTypeChecker() bool { return true }
func (noPromiseExecutorReturn) Check(ctx *Context, node *shimast.Node) {
  expression := node.AsNewExpression()
  if expression == nil || expression.Arguments == nil || len(expression.Arguments.Nodes) == 0 {
    return
  }
  callee := stripParens(expression.Expression)
  if !isGlobalPromiseConstructor(ctx, callee) {
    return
  }

  executor := stripParens(expression.Arguments.Nodes[0])
  if executor == nil || (executor.Kind != shimast.KindArrowFunction && executor.Kind != shimast.KindFunctionExpression) {
    return
  }
  body := executor.Body()
  if body == nil {
    return
  }

  var options noPromiseExecutorReturnOptions
  _ = ctx.DecodeOptions(&options)
  if executor.Kind == shimast.KindArrowFunction && body.Kind != shimast.KindBlock {
    reportPromiseExecutorReturn(ctx, body, body, options)
    return
  }
  walkPromiseExecutorReturns(body, func(returnNode, value *shimast.Node) {
    reportPromiseExecutorReturn(ctx, returnNode, value, options)
  })
}

// isGlobalPromiseConstructor proves that callee resolves to the program's
// global Promise value. The declaration guard handles script files whose
// top-level value declaration can merge into the checker global table: such a
// declaration still shadows the built-in for this source file and must not be
// treated as the standard Promise constructor.
func isGlobalPromiseConstructor(ctx *Context, callee *shimast.Node) bool {
  if ctx == nil || ctx.Checker == nil || ctx.File == nil || identifierText(callee) != "Promise" {
    return false
  }
  resolved := ctx.Checker.GetSymbolAtLocation(callee)
  global := ctx.Checker.GetGlobalSymbol("Promise", shimast.SymbolFlagsValue, nil)
  if resolved == nil || global == nil {
    return false
  }
  resolved = ctx.Checker.GetMergedSymbol(resolved)
  global = ctx.Checker.GetMergedSymbol(global)
  if resolved != global {
    return false
  }
  for _, declaration := range resolved.Declarations {
    if declaration != nil && shimast.GetSourceFileOfNode(declaration) == ctx.File &&
      promiseDeclarationIntroducesValue(declaration) {
      return false
    }
  }
  return true
}

// promiseDeclarationIntroducesValue distinguishes same-file value bindings
// from type-only declarations that legitimately merge with the global Promise
// interface. The checker already resolves nested lexical bindings to a
// different symbol; this list is only needed for declarations merged into a
// script's global symbol table.
func promiseDeclarationIntroducesValue(declaration *shimast.Node) bool {
  switch declaration.Kind {
  case
    shimast.KindVariableDeclaration,
    shimast.KindBindingElement,
    shimast.KindFunctionDeclaration,
    shimast.KindClassDeclaration,
    shimast.KindEnumDeclaration,
    shimast.KindModuleDeclaration,
    shimast.KindImportEqualsDeclaration:
    return true
  }
  return false
}

// walkPromiseExecutorReturns visits all explicit return statements owned by
// root. Nested control-flow statements are traversed naturally; nested
// functions are pruned because their return values belong to another call.
func walkPromiseExecutorReturns(root *shimast.Node, visit func(returnNode, value *shimast.Node)) {
  if root == nil {
    return
  }
  var walk func(*shimast.Node)
  walk = func(node *shimast.Node) {
    if node == nil {
      return
    }
    if node != root && isFunctionLikeKind(node) {
      return
    }
    if node.Kind == shimast.KindReturnStatement {
      statement := node.AsReturnStatement()
      if statement != nil && statement.Expression != nil {
        visit(node, statement.Expression)
      }
      return
    }
    node.ForEachChild(func(child *shimast.Node) bool {
      walk(child)
      return false
    })
  }
  walk(root)
}

func reportPromiseExecutorReturn(
  ctx *Context,
  reportNode *shimast.Node,
  value *shimast.Node,
  options noPromiseExecutorReturnOptions,
) {
  if options.AllowVoid && isExplicitVoidExpression(value) {
    return
  }
  ctx.Report(reportNode, noPromiseExecutorReturnMessage)
}

func isExplicitVoidExpression(node *shimast.Node) bool {
  node = stripParens(node)
  return node != nil && node.Kind == shimast.KindVoidExpression
}

func init() {
  Register(noPromiseExecutorReturn{})
}
