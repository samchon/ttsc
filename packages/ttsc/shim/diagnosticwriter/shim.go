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
