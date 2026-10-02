package driver_test

import (
  "bytes"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestDriverNewLintDiagnosticBoundsSourceRanges Verifies that NewLintDiagnostic bounds malformed spans and preserves a valid span, then WritePrettyDiagnostics renders each message.
//
// Named rows cover negative, reversed, beyond EOF, zero-width EOF, and valid unchanged ranges.
//
// 1. Load a source file and construct diagnostics for all five authored offset rows.
// 2. Assert each normalized start and length and render the diagnostic to verify its message.
//
// @evidence contracts/testing.md#behavioral-verification NewLintDiagnostic bounds malformed spans and preserves a valid span, then WritePrettyDiagnostics renders each message.
// @evidence contracts/testing.md#independent-expectations Authored source length and literal expected starts and lengths define bounds independently of normalization.
// @evidence contracts/testing.md#distinguishing-cases Named rows cover negative, reversed, beyond EOF, zero-width EOF, and valid unchanged ranges.
// @evidence contracts/testing.md#execution-ownership A direct Program supplies SourceFile and Go invokes the diagnostic constructor and writer. Go discovers TestDriverNewLintDiagnosticBoundsSourceRanges under ./test/driver.
func TestDriverNewLintDiagnosticBoundsSourceRanges(t *testing.T) {
  root := t.TempDir()
  writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": { "module": "commonjs", "target": "es2020" },
  "files": ["index.ts"]
}
`)
  writeProjectFile(t, root, "index.ts", "export const value = 1;\n")
  prog, diagnostics, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{ForceNoEmit: true})
  if err != nil {
    t.Fatal(err)
  }
  if len(diagnostics) != 0 {
    t.Fatalf("unexpected diagnostics: %#v", diagnostics)
  }
  defer prog.Close()
  source := prog.SourceFiles()[0]
  sourceLen := len(source.Text())

  cases := []struct {
    name       string
    pos        int
    end        int
    wantStart  int
    wantLength int
  }{
    {name: "negative", pos: -8, end: 4, wantStart: 0, wantLength: 4},
    {name: "reversed", pos: 8, end: 2, wantStart: 8, wantLength: 1},
    {name: "beyond EOF", pos: sourceLen + 10, end: sourceLen + 20, wantStart: sourceLen, wantLength: 0},
    {name: "zero-width EOF", pos: sourceLen, end: sourceLen, wantStart: sourceLen, wantLength: 0},
    {name: "valid unchanged", pos: 7, end: 12, wantStart: 7, wantLength: 5},
  }
  for _, tc := range cases {
    t.Run(tc.name, func(t *testing.T) {
      diagnostic := driver.NewLintDiagnostic(source, tc.pos, tc.end, 9501, driver.SeverityError, tc.name)
      if diagnostic.Start == nil || *diagnostic.Start != tc.wantStart ||
        diagnostic.Length == nil || *diagnostic.Length != tc.wantLength {
        t.Fatalf("diagnostic span = start %v length %v, want %d/%d: %#v",
          diagnostic.Start, diagnostic.Length, tc.wantStart, tc.wantLength, diagnostic)
      }
      var rendered bytes.Buffer
      driver.WritePrettyDiagnostics(&rendered, []driver.Diagnostic{diagnostic}, root)
      if !strings.Contains(rendered.String(), tc.name) {
        t.Fatalf("diagnostic did not render: %q", rendered.String())
      }
    })
  }
}
