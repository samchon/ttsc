package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

// default-param-last: forbid parameters with default initializers that
// precede non-default parameters. The combination forces every caller
// to spell out `undefined` for the defaulted parameter — which defeats
// the purpose of the default. ESLint canonical:
// https://eslint.org/docs/latest/rules/default-param-last
type defaultParamLast struct{}

func (defaultParamLast) Name() string { return "default-param-last" }
func (defaultParamLast) Visits() []shimast.Kind {
  return []shimast.Kind{
    shimast.KindFunctionDeclaration,
    shimast.KindFunctionExpression,
    shimast.KindArrowFunction,
    shimast.KindMethodDeclaration,
    shimast.KindConstructor,
  }
}
func (defaultParamLast) Check(ctx *Context, node *shimast.Node) {
  params := node.Parameters()
  if len(params) == 0 {
    return
  }
  // Walk right-to-left: the first non-default-like parameter sets the
  // boundary; any default-like parameter to its LEFT is mis-ordered.
  // "Default-like" includes both initializer-bearing params (`a = 1`)
  // and optional params (`a?: T`): both let callers elide the argument,
  // so placing them before a required param forces callers to write
  // `undefined` explicitly — which defeats the point of both forms.
  sawNonDefaultAfter := false
  for i := len(params) - 1; i >= 0; i-- {
    p := params[i]
    if p == nil {
      continue
    }
    decl := p.AsParameterDeclaration()
    if decl == nil {
      continue
    }
    if decl.DotDotDotToken != nil {
      // Rest parameters must be last by grammar; skip them.
      continue
    }
    isDefaultLike := decl.Initializer != nil || decl.QuestionToken != nil
    if !isDefaultLike {
      sawNonDefaultAfter = true
      continue
    }
    if sawNonDefaultAfter {
      ctx.Report(p, "Default parameters should be last.")
    }
  }
}

func init() {
  Register(defaultParamLast{})
}
