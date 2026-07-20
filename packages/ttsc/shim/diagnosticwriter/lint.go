// Lint diagnostic helpers.
//
// Plugins that participate in `ttsc check` / `ttsc build` (e.g. `@ttsc/lint`)
// need to emit findings that ride the same color/context renderer as tsgo's
// own typecheck diagnostics. The plumbing has to live next to the existing
// shim so the renderer keeps its single owner of `internal/diagnosticwriter`
// and `internal/diagnostics`.
//
// Consumers construct a `LintDiagnostic` from `(file, pos, end, code,
// category, message)` and pass it to `FormatMixedDiagnostics` together with
// any raw tsgo diagnostics. The renderer treats both the same way.
package diagnosticwriter

import (
  "cmp"
  "io"
  "slices"
  "strings"

  "github.com/microsoft/typescript-go/internal/ast"
  "github.com/microsoft/typescript-go/internal/diagnostics"
  inner "github.com/microsoft/typescript-go/internal/diagnosticwriter"
  "github.com/microsoft/typescript-go/internal/locale"
  "github.com/microsoft/typescript-go/internal/tspath"
)

// LintCategory selects warning vs error rendering. Warnings render yellow,
// errors render red — the exit-code decision lives in the caller.
type LintCategory int

const (
  LintCategoryWarning LintCategory = iota
  LintCategoryError
)

// NormalizeLintRange returns a renderer-safe half-open source span. Diagnostic
// producers are a plugin trust boundary, so offsets are clamped even when the
// caller's contract says they point inside the current file. Reversed and
// zero-width ranges select one byte when one exists at pos; EOF and empty-file
// ranges remain zero-width instead of manufacturing a byte past the source.
func NormalizeLintRange(file *ast.SourceFile, pos, end int) (int, int) {
  if file == nil {
    return 0, 0
  }
  sourceLen := len(file.Text())
  if pos < 0 {
    pos = 0
  } else if pos > sourceLen {
    pos = sourceLen
  }
  if end < 0 {
    end = 0
  } else if end > sourceLen {
    end = sourceLen
  }
  if end <= pos {
    end = pos
    if pos < sourceLen {
      end++
    }
  }
  return pos, end
}

// LintDiagnostic is a public, plugin-emittable diagnostic shaped like the
// `internal/diagnosticwriter.Diagnostic` interface. The internal type is
// unexported, so this is the only way to mix lint output with tsgo's own
// diagnostics in a single render pass.
type LintDiagnostic struct {
  file     *ast.SourceFile
  pos      int
  end      int
  code     int32
  category LintCategory
  message  string
}

// NewLintDiagnostic builds a lint diagnostic anchored at [pos, end) in the
// supplied source file. `code` shows up in the rendered banner — the
// convention is to give each rule its own stable integer.
func NewLintDiagnostic(file *ast.SourceFile, pos, end int, code int32, category LintCategory, message string) *LintDiagnostic {
  pos, end = NormalizeLintRange(file, pos, end)
  return &LintDiagnostic{
    file:     file,
    pos:      pos,
    end:      end,
    code:     code,
    category: category,
    message:  message,
  }
}

func (d *LintDiagnostic) File() inner.FileLike {
  if d == nil || d.file == nil {
    return nil
  }
  return d.file
}

func (d *LintDiagnostic) Pos() int    { return d.pos }
func (d *LintDiagnostic) End() int    { return d.end }
func (d *LintDiagnostic) Len() int    { return d.end - d.pos }
func (d *LintDiagnostic) Code() int32 { return d.code }

func (d *LintDiagnostic) Category() diagnostics.Category {
  if d.category == LintCategoryError {
    return diagnostics.CategoryError
  }
  return diagnostics.CategoryWarning
}

func (d *LintDiagnostic) Localize(_ locale.Locale) string        { return d.message }
func (d *LintDiagnostic) MessageChain() []inner.Diagnostic       { return nil }
func (d *LintDiagnostic) RelatedInformation() []inner.Diagnostic { return nil }

// Message returns the already-localized lint message.
func (d *LintDiagnostic) Message() string {
  if d == nil {
    return ""
  }
  return d.message
}

// IsError reports whether the diagnostic should fail the build. Lint plugins
// use this to compute their exit code separately from the renderer.
func (d *LintDiagnostic) IsError() bool { return d.category == LintCategoryError }

// FormatMixedDiagnostics renders raw tsgo diagnostics and lint diagnostics
// together with TypeScript-style colors and source context, followed by the
// `Found N errors` summary. Returns the count of error-level diagnostics so
// callers can decide on an exit code.
func FormatMixedDiagnostics(
  output io.Writer,
  astDiags []*ast.Diagnostic,
  lintDiags []*LintDiagnostic,
  currentDirectory string,
) int {
  if len(astDiags) == 0 && len(lintDiags) == 0 {
    return 0
  }
  all := make([]inner.Diagnostic, 0, len(astDiags)+len(lintDiags))
  errors := 0
  for _, d := range astDiags {
    if d == nil {
      continue
    }
    all = append(all, inner.WrapASTDiagnostic(d))
    if d.Category() == diagnostics.CategoryError {
      errors++
    }
  }
  for _, d := range lintDiags {
    if d == nil {
      continue
    }
    all = append(all, d)
    if d.IsError() {
      errors++
    }
  }
  if len(all) == 0 {
    return 0
  }
  options := &inner.FormattingOptions{
    Locale: locale.Default,
    ComparePathsOptions: tspath.ComparePathsOptions{
      CurrentDirectory:          currentDirectory,
      UseCaseSensitiveFileNames: true,
    },
    NewLine: "\n",
  }
  slices.SortFunc(all, compareMixedDiagnostics)
  inner.FormatDiagnosticsWithColorAndContext(output, all, options)
  inner.WriteErrorSummaryText(output, all, options)
  return errors
}

// compareMixedDiagnostics imposes one deterministic source order on tsgo and
// lint diagnostics before the upstream renderer consumes them. The renderer
// intentionally writes its input order, while the two producers have separate
// collection paths; ordering here keeps neither producer's traversal visible
// in CLI output.
func compareMixedDiagnostics(a, b inner.Diagnostic) int {
  if c := strings.Compare(mixedDiagnosticFileName(a), mixedDiagnosticFileName(b)); c != 0 {
    return c
  }
  if c := cmp.Compare(a.Pos(), b.Pos()); c != 0 {
    return c
  }
  if c := cmp.Compare(a.End(), b.End()); c != 0 {
    return c
  }
  if c := cmp.Compare(a.Code(), b.Code()); c != 0 {
    return c
  }
  if c := cmp.Compare(a.Category(), b.Category()); c != 0 {
    return c
  }
  if c := strings.Compare(a.Localize(locale.Default), b.Localize(locale.Default)); c != 0 {
    return c
  }
  if c := compareMixedDiagnosticLists(a.MessageChain(), b.MessageChain()); c != 0 {
    return c
  }
  return compareMixedDiagnosticLists(a.RelatedInformation(), b.RelatedInformation())
}

func mixedDiagnosticFileName(d inner.Diagnostic) string {
  if file := d.File(); file != nil {
    return file.FileName()
  }
  return ""
}

func compareMixedDiagnosticLists(a, b []inner.Diagnostic) int {
  for i := 0; i < len(a) && i < len(b); i++ {
    if c := compareMixedDiagnostics(a[i], b[i]); c != 0 {
      return c
    }
  }
  return cmp.Compare(len(a), len(b))
}
