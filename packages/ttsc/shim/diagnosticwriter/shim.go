// Package diagnosticwriter re-exports the subset of typescript-go's
// internal/diagnosticwriter surface that the ttsc driver uses. It provides
// FormatASTDiagnosticsWithColorAndContext for rendering pure tsgo diagnostics
// and delegates the mixed lint+tsgo rendering path to the adjacent lint.go.
package diagnosticwriter

import (
  "io"

  "github.com/microsoft/typescript-go/internal/ast"
  inner "github.com/microsoft/typescript-go/internal/diagnosticwriter"
  "github.com/microsoft/typescript-go/internal/locale"
  "github.com/microsoft/typescript-go/internal/tspath"
)

// FormatASTDiagnosticsWithColorAndContext writes TypeScript-style pretty
// diagnostics using the same internal formatter as typescript-go.
// diagnostics must contain non-nil compiler diagnostics; output and source
// files retain their caller-owned lifetimes.
//
// @evidence contracts/common.md#principled-implementation Upstream AST adapters implement the formatter's Diagnostic interface, and the same rendering/summary operations receive them with the caller's current directory and default locale.
// @evidence contracts/common.md#clear-and-simple-design One pure-AST rendering entry composes adaptation, contextual formatting and summary emission; mixed lint rendering stays in its separate adjacent entry.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The supplied output writer receives real compiler messages; no global stream replacement or source-pattern diagnostic approximation is involved.
// @evidence contracts/common.md#meaningful-documentation Native prose identifies upstream formatting, non-nil input requirements and caller-owned writer/source lifetime before these tags.
func FormatASTDiagnosticsWithColorAndContext(output io.Writer, diagnostics []*ast.Diagnostic, currentDirectory string) {
  if len(diagnostics) == 0 {
    return
  }
  formatted := inner.FromASTDiagnostics(diagnostics)
  options := &inner.FormattingOptions{
    Locale: locale.Default,
    ComparePathsOptions: tspath.ComparePathsOptions{
      CurrentDirectory:          currentDirectory,
      UseCaseSensitiveFileNames: true,
    },
    NewLine: "\n",
  }
  inner.FormatDiagnosticsWithColorAndContext(output, formatted, options)
  inner.WriteErrorSummaryText(output, formatted, options)
}
