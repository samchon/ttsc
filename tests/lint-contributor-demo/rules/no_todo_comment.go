// Package demo is a test-only `@ttsc/lint` contributor.
//
// Demonstrates the contributor protocol:
//  1. Build-time: `@ttsc/lint`'s JS factory finds this package via
//     tsconfig's `plugins: { demo: "lint-contributor-demo" }`, resolves
//     its `source` directory, and tells ttsc to merge it into the lint
//     binary as a sub-package.
//  2. Compile time: the host module copies these `.go` files into
//     `<scratch>/contrib/demo/` and synthesizes a blank import in the
//     main package, which triggers the `init()` below before `main`.
//  3. Runtime: `rule.Register(noTodoComment{})` populates the public
//     contributor registry. The host's adapter (`contrib_adapter.go`)
//     copies that registration into the engine's dispatch table, so a
//     user setting `"demo/no-todo-comment": "error"` in `lint.config.ts`
//     sees the same diagnostic stream as built-in rules emit.
//
// Notice that this file imports `github.com/microsoft/typescript-go/shim/...`
// directly — the rule package does NOT add another wrapper layer on top
// of shim. Contributors and built-ins consume the same AST surface
// (`shim/ast`, `shim/scanner`, etc.) that other ttsc plugins
// already depend on. The shim is the publicly maintained boundary; no
// duplicate facade in between.
package demo

import (
  "strings"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimscanner "github.com/microsoft/typescript-go/shim/scanner"

  "github.com/samchon/ttsc/packages/lint/rule"
)

func init() {
  rule.Register(noTodoComment{})
}

// noTodoComment flags `TODO` and `FIXME` markers inside line and block
// comments. Uses `shim/scanner` to tokenize the source file — the same
// path `@ttsc/lint`'s built-in `parseLintInlineDirectives` walks — so
// the contributor inherits the compiler's exact notion of "what is a
// comment" instead of guessing with substring matches.
type noTodoComment struct{}

func (noTodoComment) Name() string { return "demo/no-todo-comment" }

func (noTodoComment) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindSourceFile}
}

func (noTodoComment) Check(ctx *rule.Context, _ *shimast.Node) {
  if ctx == nil || ctx.File == nil {
    return
  }
  scanner := shimscanner.NewScanner()
  scanner.SetText(ctx.File.Text())
  scanner.SetSkipTrivia(false)
  for {
    kind := scanner.Scan()
    if kind == shimast.KindEndOfFile {
      return
    }
    if kind != shimast.KindSingleLineCommentTrivia &&
      kind != shimast.KindMultiLineCommentTrivia {
      continue
    }
    token := scanner.TokenText()
    start := scanner.TokenStart()
    reportMarker(ctx, token, start, "TODO", "TODO comment is not allowed.")
    reportMarker(ctx, token, start, "FIXME", "FIXME comment is not allowed.")
  }
}

func reportMarker(ctx *rule.Context, token string, tokenStart int, marker, message string) {
  offset := strings.Index(token, marker)
  if offset < 0 {
    return
  }
  ctx.ReportRange(tokenStart+offset, tokenStart+offset+len(marker), message)
}
