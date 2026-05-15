package main

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
  // Walk right-to-left; once we see a parameter without an Initializer
  // (and not a rest parameter), every earlier parameter that DOES have
  // an Initializer is misordered.
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
      // Rest parameters are always last by grammar; they don't
      // participate in the default-position check.
      continue
    }
    // typescript-eslint canonical treats both default-initialized and
    // optional (`a?: T`) parameters as default-like for ordering: both
    // permit callers to elide the argument, so a non-optional / non-
    // default parameter after either one forces the caller to spell
    // `undefined`. The round-1 implementation only checked Initializer;
    // round 2 adds the QuestionToken branch.
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
