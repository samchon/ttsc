package linthost

import (
  "bytes"
  "strings"
  "testing"

  shimdw "github.com/microsoft/typescript-go/shim/diagnosticwriter"
)

// TestMixedDiagnosticsRenderOrdersFilesAndTies verifies the shared renderer
// orders mixed batches by path and then applies deterministic source-key
// tiebreaks when two findings share one source range.
//
// 1. Supply findings in reverse file and code order.
// 2. Render the same batch twice through the shared formatter.
// 3. Assert file, source-key, and repeatable output order.
func TestMixedDiagnosticsRenderOrdersFilesAndTies(t *testing.T) {
  firstFile := parseTSFile(t, "/virtual/a.ts", "const alpha = 1;\n")
  secondFile := parseTSFile(t, "/virtual/b.ts", "const broken: = 1;\n")
  astDiags := secondFile.Diagnostics()
  if len(astDiags) == 0 {
    t.Fatal("malformed second file did not produce a parser diagnostic")
  }
  diagnostics := []*shimdw.LintDiagnostic{
    shimdw.NewLintDiagnostic(secondFile, 0, 5, 9201, shimdw.LintCategoryWarning, "second file"),
    shimdw.NewLintDiagnostic(firstFile, 0, 5, 9202, shimdw.LintCategoryWarning, "same range, higher code"),
    shimdw.NewLintDiagnostic(firstFile, 0, 5, 9201, shimdw.LintCategoryWarning, "same range, lower code"),
  }

  var first bytes.Buffer
  shimdw.FormatMixedDiagnostics(&first, astDiags, diagnostics, "/virtual")
  var second bytes.Buffer
  shimdw.FormatMixedDiagnostics(&second, astDiags, diagnostics, "/virtual")
  if first.String() != second.String() {
    t.Fatalf("identical mixed batches rendered differently:\nfirst:\n%s\nsecond:\n%s", first.String(), second.String())
  }
  output := first.String()
  lowerCode := strings.Index(output, "same range, lower code")
  higherCode := strings.Index(output, "same range, higher code")
  secondFileIndex := strings.Index(output, "second file")
  parserIndex := strings.Index(output, astDiags[0].String())
  if lowerCode < 0 || higherCode < 0 || secondFileIndex < 0 || parserIndex < 0 {
    t.Fatalf("mixed render omitted an expected diagnostic:\n%s", output)
  }
  if lowerCode > higherCode || higherCode > secondFileIndex || secondFileIndex > parserIndex {
    t.Fatalf("diagnostics are not ordered by file, position, end, and code:\n%s", output)
  }
}
