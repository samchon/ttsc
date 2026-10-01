// maxDepth: deeply nested block statements are a readability tax — the
// reader must hold every enclosing condition or loop in mind to reason
// about the innermost statement. ESLint's default is `{ max: 4 }`, which
// @ttsc/lint mirrors as the only built-in threshold (option-decoding is
// deferred). Each function body re-starts the depth counter so nested
// function-like declarations are measured independently.
// https://eslint.org/docs/latest/rules/max-depth
package linthost

import (
  "fmt"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// maxDepthLimit is the block-nesting ceiling. Above this value the rule
// fires. Mirrors the ESLint default and matches the threshold documented
// in the README and website MDX.
const maxDepthLimit = 4

type maxDepth struct{}

func (maxDepth) Name() string { return "max-depth" }
func (maxDepth) Visits() []shimast.Kind {
  return []shimast.Kind{
    shimast.KindFunctionDeclaration,
    shimast.KindFunctionExpression,
    shimast.KindArrowFunction,
    shimast.KindMethodDeclaration,
  }
}
func (maxDepth) Check(ctx *Context, node *shimast.Node) {
  if node == nil {
    return
  }
  body := node.Body()
  if body == nil || body.Kind != shimast.KindBlock {
    return
  }
  walkMaxDepthBody(body, node, 0, ctx)
}

// walkMaxDepthBody descends through `root` counting nested block-bearing
// statements without crossing nested function-like scopes. Each nested
// function is left for its own visit. The depth counter increments on
// statements whose bodies introduce a new block: `if`, `else`, `for`,
// `for-in`, `for-of`, `while`, `do-while`, `switch`, and `try` (plus
// each `catch` clause). When the depth exceeds the configured limit, a
// single finding is reported at the offending statement and the
// recursive walk continues so independent over-limit branches each get
// their own diagnostic.
func walkMaxDepthBody(node *shimast.Node, fn *shimast.Node, depth int, ctx *Context) {
  if node == nil {
    return
  }
  if node != fn && isFunctionLikeKind(node) {
    return
  }
  switch node.Kind {
  case shimast.KindIfStatement,
    shimast.KindForStatement,
    shimast.KindForInStatement,
    shimast.KindForOfStatement,
    shimast.KindWhileStatement,
    shimast.KindDoStatement,
    shimast.KindSwitchStatement,
    shimast.KindTryStatement,
    shimast.KindCatchClause,
    shimast.KindWithStatement:
    depth++
    if depth > maxDepthLimit {
      ctx.Report(node, fmt.Sprintf("Blocks are nested too deeply (%d). Maximum allowed is %d.", depth, maxDepthLimit))
    }
  }
  node.ForEachChild(func(child *shimast.Node) bool {
    walkMaxDepthBody(child, fn, depth, ctx)
    return false
  })
}

func init() {
  Register(maxDepth{})
}
