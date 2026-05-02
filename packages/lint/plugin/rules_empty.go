package main

import shimast "github.com/microsoft/typescript-go/shim/ast"

// no-empty: empty block statements (`{}`), but allow empty catch
// clauses since they're idiomatic for "ignore the error".
// https://eslint.org/docs/latest/rules/no-empty
type noEmpty struct{}

func (noEmpty) Name() string           { return "no-empty" }
func (noEmpty) Visits() []shimast.Kind { return []shimast.Kind{shimast.KindBlock} }
func (noEmpty) Check(ctx *Context, node *shimast.Node) {
  block := node.AsBlock()
  if block == nil || block.Statements == nil {
    return
  }
  if len(block.Statements.Nodes) > 0 {
    return
  }
  parent := node.Parent
  if parent != nil && parent.Kind == shimast.KindCatchClause {
    return // tolerated — see ESLint default options
  }
  if isFunctionLikeKind(parent) {
    return // empty function body is `no-empty-function`'s job
  }
  ctx.Report(node, "Empty block statement.")
}

// no-empty-function: empty function / method / arrow / accessor bodies.
// https://eslint.org/docs/latest/rules/no-empty-function
type noEmptyFunction struct{}

func (noEmptyFunction) Name() string { return "no-empty-function" }
func (noEmptyFunction) Visits() []shimast.Kind {
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
func (noEmptyFunction) Check(ctx *Context, node *shimast.Node) {
  body := node.Body()
  if body == nil {
    return
  }
  if body.Kind != shimast.KindBlock {
    return
  }
  block := body.AsBlock()
  if block == nil || block.Statements == nil {
    return
  }
  if len(block.Statements.Nodes) == 0 {
    ctx.Report(node, "Unexpected empty function.")
  }
}

// no-empty-pattern: `({}) => x` or `function ({}) {}` — destructuring
// patterns with no bindings are usually a bug.
// https://eslint.org/docs/latest/rules/no-empty-pattern
type noEmptyPattern struct{}

func (noEmptyPattern) Name() string { return "no-empty-pattern" }
func (noEmptyPattern) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindObjectBindingPattern, shimast.KindArrayBindingPattern}
}
func (noEmptyPattern) Check(ctx *Context, node *shimast.Node) {
  pattern := node.AsBindingPattern()
  if pattern == nil || pattern.Elements == nil {
    return
  }
  if len(pattern.Elements.Nodes) == 0 {
    shape := "object"
    if node.Kind == shimast.KindArrayBindingPattern {
      shape = "array"
    }
    ctx.Report(node, "Unexpected empty "+shape+" pattern.")
  }
}

// isFunctionLikeKind reports whether the node represents a function-like
// host whose body is the relevant scope for the empty check.
func isFunctionLikeKind(n *shimast.Node) bool {
  if n == nil {
    return false
  }
  switch n.Kind {
  case
    shimast.KindFunctionDeclaration,
    shimast.KindFunctionExpression,
    shimast.KindArrowFunction,
    shimast.KindMethodDeclaration,
    shimast.KindGetAccessor,
    shimast.KindSetAccessor,
    shimast.KindConstructor:
    return true
  }
  return false
}

func init() {
  Register(noEmpty{})
  Register(noEmptyFunction{})
  Register(noEmptyPattern{})
}
