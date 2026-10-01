// typescript/prefer-regexp-exec: prefer `re.exec(str)` over
// `str.match(re)` when the regex has no `g` flag. Both shapes return
// the same `RegExpExecArray | null` for first-match queries, but
// `String#match` silently switches to "every match" the moment the
// regex gains the `g` flag — a typo at the regex literal can change
// the call's return shape from `[fullMatch, ...captures]` to a flat
// `string[]` of matches. `RegExp#exec` is the stable form.
// typescript-eslint:
// https://typescript-eslint.io/rules/prefer-regexp-exec/
//
// Type-aware. Without a Checker the rule cannot prove the receiver of
// `match` is string-like, so Context.Checker == nil short-circuits each
// Check to a no-op the way `prefer-includes` and
// `prefer-string-starts-ends-with` do. The argument must be a regex
// literal — the AST-only baseline reads the flag suffix directly off
// the token text; non-literal regex arguments (a `new RegExp(...)`,
// a `const re = /.../` aliased through a variable) are conservatively
// skipped because static flag tracking would explode in scope.
package linthost

import (
  "strings"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimchecker "github.com/microsoft/typescript-go/shim/checker"
)

type preferRegexpExec struct{}

func (preferRegexpExec) Name() string { return "typescript/prefer-regexp-exec" }
func (preferRegexpExec) NeedsTypeChecker() bool {
  return true
}
func (preferRegexpExec) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindCallExpression}
}
func (preferRegexpExec) Check(ctx *Context, node *shimast.Node) {
  if ctx.Checker == nil {
    return
  }
  call := node.AsCallExpression()
  if call == nil || call.Expression == nil {
    return
  }
  receiver, method, ok := promisePropertyAccessParts(call.Expression)
  if !ok || method != "match" {
    return
  }
  if receiver == nil {
    return
  }
  if call.Arguments == nil || len(call.Arguments.Nodes) != 1 {
    return
  }
  arg := stripParens(call.Arguments.Nodes[0])
  if arg == nil || arg.Kind != shimast.KindRegularExpressionLiteral {
    return
  }
  // Skip when the regex literal carries the `g` flag — `String#match`
  // returns every match in that mode, which `RegExp#exec` cannot
  // replicate in a single call.
  if preferRegexpExecHasGlobalFlag(ctx.File, arg) {
    return
  }
  if !preferRegexpExecIsString(ctx.Checker.GetTypeAtLocation(receiver)) {
    return
  }
  ctx.Report(node, preferRegexpExecMessage)
}

const preferRegexpExecMessage = "Prefer `RegExp#exec(str)` over `String#match(re)` when the regex has no `g` flag — `exec` returns the same first-match shape and avoids the `g`-flag fallthrough that silently changes the return type of `match`."

// preferRegexpExecHasGlobalFlag reports whether the regex literal at
// `node` carries the `g` flag. The flag string follows the closing `/`
// of the literal (e.g. `/foo/gi` has flags `"gi"`); the scanner has
// already validated the token, so a textual scan of the trailing
// suffix is sufficient.
func preferRegexpExecHasGlobalFlag(file *shimast.SourceFile, node *shimast.Node) bool {
  raw := nodeText(file, node)
  if len(raw) < 2 || raw[0] != '/' {
    return false
  }
  closing := strings.LastIndexByte(raw, '/')
  if closing <= 0 {
    return false
  }
  flags := raw[closing+1:]
  return strings.Contains(flags, "g")
}

// preferRegexpExecIsString reports whether t is provably string-like.
// Mirrors `preferStringStartsEndsWithIsString`: `any` / `unknown` /
// `never` are rejected so generic helpers don't fire. Union and
// intersection types must have every constituent string-like.
func preferRegexpExecIsString(t *shimchecker.Type) bool {
  if t == nil {
    return false
  }
  flags := t.Flags()
  if flags&(shimchecker.TypeFlagsAny|shimchecker.TypeFlagsUnknown|shimchecker.TypeFlagsNever) != 0 {
    return false
  }
  if flags&shimchecker.TypeFlagsStringLike != 0 {
    return true
  }
  if flags&(shimchecker.TypeFlagsUnion|shimchecker.TypeFlagsIntersection) != 0 {
    for _, part := range t.Types() {
      if part == nil {
        continue
      }
      if !preferRegexpExecIsString(part) {
        return false
      }
    }
    return true
  }
  return false
}

func init() {
  Register(preferRegexpExec{})
}
