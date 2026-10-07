package linthost

import (
  "bytes"
  "strings"
  "testing"

  shimdw "github.com/microsoft/typescript-go/shim/diagnosticwriter"
)

// TestMixedDiagnosticsRenderInterleavesParserAndLint verifies the shared
// renderer places an earlier lint finding before a later tsgo parser error,
// instead of preserving the producers' separate collection order.
//
// 1. Parse a source whose parser error is on the second line.
// 2. Add a lint error on the first line and render the mixed batch.
// 3. Assert source order and the unchanged error count.
//
// @evidence contracts/testing.md#behavioral-verification The shared renderer interleaves an authored first-line lint error before a real second-line parser error and counts every error from both producers.
// @evidence contracts/testing.md#independent-expectations The authored source determines line order independently of the renderer; the upstream parser supplies actual malformed-source diagnostics while a literal lint message identifies the separate producer.
// @evidence contracts/testing.md#distinguishing-cases Parser findings supplied separately from lint must not preserve producer order; both messages must exist before their indices are compared, preventing missing diagnostics from satisfying ordering.
// @evidence contracts/testing.md#execution-ownership Real parser diagnostics and a real supported LintDiagnostic enter the production Go writer in-memory, without a compiler child, native plugin, installed CLI or mock renderer.
func TestMixedDiagnosticsRenderInterleavesParserAndLint(t *testing.T) {
  source := parseTSFile(t, "/virtual/mixed.ts", "const early = 1;\nconst broken: = 2;\n")
  astDiags := source.Diagnostics()
  if len(astDiags) == 0 {
    t.Fatal("malformed source did not produce a parser diagnostic")
  }
  lint := shimdw.NewLintDiagnostic(
    source,
    6,
    11,
    9101,
    shimdw.LintCategoryError,
    "lint finding on the first line",
  )

  var rendered bytes.Buffer
  if got, want := shimdw.FormatMixedDiagnostics(&rendered, astDiags, []*shimdw.LintDiagnostic{lint}, "/virtual"), len(astDiags)+1; got != want {
    t.Fatalf("error count = %d, want %d", got, want)
  }
  output := rendered.String()
  lintIndex := strings.Index(output, lint.Message())
  parserIndex := strings.Index(output, astDiags[0].String())
  if lintIndex < 0 || parserIndex < 0 {
    t.Fatalf("mixed render omitted a diagnostic:\n%s", output)
  }
  if lintIndex > parserIndex {
    t.Fatalf("diagnostics retained producer order instead of source order:\n%s", output)
  }
}
