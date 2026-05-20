package linthost

import (
  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimchecker "github.com/microsoft/typescript-go/shim/checker"
)

// await-thenable: `await x` where `x` is not a Promise and not a
// thenable is always a no-op. The runtime resolves `await 42` to `42`
// after one microtask hop — almost never the intent. typescript-eslint
// recommended-type-checked:
// https://typescript-eslint.io/rules/await-thenable/
//
// This is the first rule in the corpus to consult `ctx.Checker`. The
// shim's `Checker` is a type alias for tsgo's `*innerchecker.Checker`,
// so every exported method (`GetTypeAtLocation`, `GetPromisedTypeOfPromise`,
// `GetPropertyOfType`, `GetSignaturesOfType`) is callable directly with
// no shim addition.
type awaitThenable struct{}

func (awaitThenable) Name() string { return "await-thenable" }
func (awaitThenable) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindAwaitExpression}
}
func (awaitThenable) Check(ctx *Context, node *shimast.Node) {
  if ctx.Checker == nil {
    return
  }
  expr := node.AsAwaitExpression()
  if expr == nil || expr.Expression == nil {
    return
  }
  operandType := ctx.Checker.GetTypeAtLocation(expr.Expression)
  if operandType == nil {
    return
  }
  if isAwaitable(ctx.Checker, operandType) {
    return
  }
  message := "Unexpected `await` of a non-Promise (non-thenable) value."
  // Fix: drop the `await ` keyword and the following whitespace by
  // replacing [node.Pos(), expr.Expression.Pos()) with empty text.
  // `node.Pos()` may include leading trivia; use tokenRange to anchor
  // the start at the actual `await` token.
  startPos, _ := tokenRange(ctx.File, node)
  operandStart := expr.Expression.Pos()
  if startPos < 0 || operandStart <= startPos {
    ctx.Report(node, message)
    return
  }
  ctx.ReportFix(
    node,
    message,
    TextEdit{Pos: startPos, End: operandStart, Text: ""},
  )
}

// isAwaitable reports whether `t` is safe to `await`. A type is awaitable
// when it is `any` / `unknown` / `never` (out of scope for strictness),
// when it is a Promise, when it is a thenable (has a callable `then`),
// or — for union/intersection types — when ANY constituent satisfies one
// of the above. The union case is the round-2 repair: `GetPromisedTypeOfPromise`
// returns nil on `Promise<X> | number` because the outer type is not a
// reference to globalPromise, and `GetPropertyOfType` filters `then` as
// a partial member, so without iterating constituents the rule would
// fire on legitimate code.
// isAwaitable reports whether t is safe to await. A type is awaitable when:
//   - its flags include Any, Unknown, or Never (these escape static strictness);
//   - it is a Promise (GetPromisedTypeOfPromise returns non-nil); or
//   - it is thenable (has a callable `then` property).
//
// For union and intersection types the function recurses into constituents: if
// ANY constituent is awaitable the whole type is considered awaitable. This is
// necessary because GetPromisedTypeOfPromise returns nil on composite types
// like `Promise<X> | number` even though the expression can legally be awaited.
func isAwaitable(checker *shimchecker.Checker, t *shimchecker.Type) bool {
  if checker == nil || t == nil {
    return false
  }
  flags := t.Flags()
  if flags&shimchecker.TypeFlagsAny != 0 ||
    flags&shimchecker.TypeFlagsUnknown != 0 ||
    flags&shimchecker.TypeFlagsNever != 0 {
    return true
  }
  if flags&(shimchecker.TypeFlagsUnion|shimchecker.TypeFlagsIntersection) != 0 {
    for _, part := range t.Types() {
      if part == nil {
        continue
      }
      if isAwaitable(checker, part) {
        return true
      }
    }
    return false
  }
  if checker.GetPromisedTypeOfPromise(t) != nil {
    return true
  }
  return isThenableType(checker, t)
}

// isThenableType reports whether t has a callable `then` property, which is
// the runtime-observable contract for "thenable" in the ES spec. The check
// intentionally mirrors what the JS engine uses at await-time.
func isThenableType(checker *shimchecker.Checker, t *shimchecker.Type) bool {
  if checker == nil || t == nil {
    return false
  }
  prop := checker.GetPropertyOfType(t, "then")
  if prop == nil {
    return false
  }
  propType := checker.GetTypeOfSymbol(prop)
  if propType == nil {
    return false
  }
  return len(checker.GetSignaturesOfType(propType, shimchecker.SignatureKindCall)) > 0
}

func init() {
  Register(awaitThenable{})
}
