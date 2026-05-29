// unicorn/no-invalid-fetch-options: passing a `body` together with a
// `GET` or `HEAD` `fetch()` call throws at runtime because the spec
// forbids a request body for those methods. The rule catches the
// mismatch at parse time so the throw never reaches production.
//
// AST-only: visit each `CallExpression`, match when the callee is a
// bare `fetch` identifier and the second argument is an object literal
// containing both a string-literal `method` of `GET` / `HEAD`
// (case-insensitive) AND a `body` property of any shape. Report on the
// call so the diagnostic lands at the offending site.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-invalid-fetch-options.md
package linthost

import (
  "strings"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

type unicornNoInvalidFetchOptions struct{}

func (unicornNoInvalidFetchOptions) Name() string { return "unicorn/no-invalid-fetch-options" }
func (unicornNoInvalidFetchOptions) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindCallExpression}
}
func (unicornNoInvalidFetchOptions) Check(ctx *Context, node *shimast.Node) {
  call := node.AsCallExpression()
  if call == nil {
    return
  }
  if identifierText(call.Expression) != "fetch" {
    return
  }
  if call.Arguments == nil || len(call.Arguments.Nodes) < 2 {
    return
  }
  init := stripParens(call.Arguments.Nodes[1])
  if init == nil || init.Kind != shimast.KindObjectLiteralExpression {
    return
  }
  obj := init.AsObjectLiteralExpression()
  if obj == nil || obj.Properties == nil {
    return
  }
  hasBody := false
  methodIsBodyless := false
  for _, prop := range obj.Properties.Nodes {
    if prop == nil || prop.Kind != shimast.KindPropertyAssignment {
      continue
    }
    assignment := prop.AsPropertyAssignment()
    if assignment == nil || assignment.Name() == nil {
      continue
    }
    key := identifierText(assignment.Name())
    if key == "" && assignment.Name().Kind == shimast.KindStringLiteral {
      key = stringLiteralText(assignment.Name())
    }
    switch key {
    case "body":
      hasBody = true
    case "method":
      value := stripParens(assignment.Initializer)
      if value != nil && value.Kind == shimast.KindStringLiteral {
        m := strings.ToLower(stringLiteralText(value))
        if m == "get" || m == "head" {
          methodIsBodyless = true
        }
      }
    }
  }
  if hasBody && methodIsBodyless {
    ctx.Report(node, "Don't pass `body` with GET/HEAD `fetch` — it throws at runtime.")
  }
}

func init() {
  Register(unicornNoInvalidFetchOptions{})
}
