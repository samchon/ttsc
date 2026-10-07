// unicorn/no-useless-error-capture-stack-trace reports the explicit this-target
// capture policy. A supplied constructor filter must name the surrounding
// constructor or new.target; an external filter can remove meaningful frames.
// The name-based matcher does not prove Error inheritance or builtin identity.
// It retains the existing no-filter policy without claiming every such call
// produces an equivalent runtime stack. No automatic rewrite is supplied.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-useless-error-capture-stack-trace.md
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

type unicornNoUselessErrorCaptureStackTrace struct{}

func (unicornNoUselessErrorCaptureStackTrace) Name() string {
  return "unicorn/no-useless-error-capture-stack-trace"
}
func (unicornNoUselessErrorCaptureStackTrace) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindCallExpression}
}
func (unicornNoUselessErrorCaptureStackTrace) Check(ctx *Context, node *shimast.Node) {
  call := node.AsCallExpression()
  if call == nil || call.Expression == nil {
    return
  }
  if !isMatchingPropertyAccess(call.Expression, "Error", "captureStackTrace") {
    return
  }
  if call.Arguments == nil || len(call.Arguments.Nodes) < 1 {
    return
  }
  first := stripParens(call.Arguments.Nodes[0])
  if first == nil || first.Kind != shimast.KindThisKeyword {
    return
  }
  if len(call.Arguments.Nodes) >= 2 {
    filter := stripParens(call.Arguments.Nodes[1])
    var constructor *shimast.Node
    for parent := node.Parent; parent != nil; parent = parent.Parent {
      if parent.Kind == shimast.KindConstructor {
        constructor = parent
        break
      }
      if isFunctionLikeKind(parent) {
        break
      }
    }
    if constructor == nil || constructor.Parent == nil || filter == nil {
      return
    }
    owner := constructor.Parent.Name()
    if filter.Kind != shimast.KindMetaProperty && (filter.Kind != shimast.KindIdentifier || identifierText(filter) != identifierText(owner)) {
      return
    }
    if filter.Kind == shimast.KindMetaProperty && nodeText(ctx.File, filter) != "new.target" {
      return
    }
  }
  ctx.Report(node, "Don't call `Error.captureStackTrace(this, ...)` in an `Error` subclass — the default capture already happens.")
}

func init() {
  Register(unicornNoUselessErrorCaptureStackTrace{})
}
