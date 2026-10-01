// maxLinesPerFunction: a function whose body spans many lines is hard
// to scan and almost always benefits from extraction. ESLint's default
// is `{ max: 50 }`, which @ttsc/lint mirrors as the only built-in
// threshold (option-decoding is deferred). The line-span is measured
// between the opening and closing braces of the function's block body,
// inclusive, so the count reflects the real footprint a reader sees in
// the source — including blank lines and comments.
// https://eslint.org/docs/latest/rules/max-lines-per-function
package linthost

import (
  "fmt"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimscanner "github.com/microsoft/typescript-go/shim/scanner"
)

// maxLinesPerFunctionLimit is the line-span ceiling. Above this value
// the rule fires. Mirrors the ESLint default and matches the threshold
// documented in the README and website MDX.
const maxLinesPerFunctionLimit = 50

type maxLinesPerFunction struct{}

func (maxLinesPerFunction) Name() string { return "max-lines-per-function" }
func (maxLinesPerFunction) Visits() []shimast.Kind {
  return []shimast.Kind{
    shimast.KindFunctionDeclaration,
    shimast.KindFunctionExpression,
    shimast.KindArrowFunction,
    shimast.KindMethodDeclaration,
  }
}
func (maxLinesPerFunction) Check(ctx *Context, node *shimast.Node) {
  if node == nil || ctx == nil || ctx.File == nil {
    return
  }
  body := node.Body()
  if body == nil || body.Kind != shimast.KindBlock {
    return
  }
  startPos := shimscanner.SkipTrivia(ctx.File.Text(), body.Pos())
  endPos := body.End()
  if endPos > startPos {
    endPos--
  }
  startLine := shimscanner.GetECMALineOfPosition(ctx.File, startPos)
  endLine := shimscanner.GetECMALineOfPosition(ctx.File, endPos)
  lines := endLine - startLine + 1
  if lines > maxLinesPerFunctionLimit {
    ctx.Report(node, fmt.Sprintf("Function has too many lines (%d). Maximum allowed is %d.", lines, maxLinesPerFunctionLimit))
  }
}

func init() {
  Register(maxLinesPerFunction{})
}
