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
// The writer must be usable, and locations/message chains must satisfy the
// formatter's compiler-data premises. Upstream ignores individual write errors;
// this void operation neither reports successful delivery nor closes the writer.
//
// @evidence contracts/common.md#principled-implementation Upstream AST adapters implement the formatter's Diagnostic interface, and the same rendering/summary operations receive them with the caller's current directory and default locale.
// @evidence contracts/common.md#clear-and-simple-design One pure-AST rendering entry composes adaptation, contextual formatting and summary emission; mixed lint rendering stays in its separate adjacent entry.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The supplied output writer receives real compiler messages; no global stream replacement or source-pattern diagnostic approximation is involved.
// @evidence contracts/common.md#meaningful-documentation Native prose identifies upstream formatting, non-nil input requirements and caller-owned writer/source lifetime before these tags.
// @evidence contracts/performance.md#bound-retention-and-release-resources Adapted diagnostic and related/message-chain arrays, snippet strings and summary grouping/sorting state are invocation-local, borrowing caller diagnostic/source graphs. Supplied writer storage and any source-position caches remain with their owners; output can remain retained by that writer after return. This adapter neither closes it nor imposes a fixed byte/population cap, and local state becoming unreachable does not promise immediate reclamation.
// @evidence contracts/performance.md#efficient-algorithms Adapt the input once, render diagnostics in supplied order, then build the error summary. Actual work includes nested messages/related data, path text, source-position lookup and snippet bytes, plus a second diagnostic scan and filename grouping/sort for the summary. Writer operations contribute their own cost; one formatter call does not make the whole operation a single linear pass over diagnostic count.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This call-local renderer coordinates no completed/in-flight formatted-result cache. Upstream and source owners manage reusable message/localization or source-position state, while the caller owns whether emitted output can be reused for equivalent diagnostics and context.
// @evidence contracts/portability.md#os-neutral-implementation The path comparison options carry the supplied current directory and a fixed case-sensitive policy because the writer only renders display paths and compares no filesystem identities.
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
