package driver_test

import (
  "bytes"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestDriverDiagnosticShapes verifies public diagnostic helpers that plugins
// use to integrate with the native checker pipeline.
//
// The assertions keep the plugin-facing lint diagnostic DTO and plain fallback
// renderer stable without reaching into shim-private types.
//
// 1. Load a source file so lint diagnostics can be anchored to real text.
// 2. Shape warning and error diagnostics through the public constructor.
// 3. Assert counting and plain fallback rendering contracts.
// @evidence contracts/testing.md#behavioral-verification Loads an authored program, constructs public warning/error diagnostics and asserts zero-width normalization, error count and plain rendering.
// @evidence contracts/testing.md#independent-expectations Literal line 1, column 1, length 1, error count 2 and src/main.ts:2:4: plain establish the observable DTO and fallback contract.
// @evidence contracts/testing.md#distinguishing-cases Anchored warning/error diagnostics distinguish severity and zero-width handling; unanchored plain messages exercise fallback counting and rendering.
// @evidence contracts/testing.md#execution-ownership The owning Go unit calls the in-process program and public diagnostic APIs, closes its program and owns a t.TempDir fixture; no product executable is spawned.
func TestDriverDiagnosticShapes(t *testing.T) {
  root := t.TempDir()

  // Scenario setup: lint diagnostics need a real SourceFile to compute line and
  // column offsets consistently with TypeScript-Go.
  writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": {
    "module": "commonjs",
    "target": "es2020"
  },
  "files": ["index.ts"]
}
`)
  writeProjectFile(t, root, "index.ts", `export const value = 1;
`)
  prog, diags, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{ForceNoEmit: true})
  if err != nil {
    t.Fatal(err)
  }
  if len(diags) != 0 {
    t.Fatalf("unexpected diagnostics: %#v", diags)
  }
  defer prog.Close()
  source := prog.SourceFiles()[0]

  // Diagnostic assertion: zero-length lint ranges are widened by the renderer
  // shim and reflected in the public DTO length.
  warning := driver.NewLintDiagnostic(source, 0, 0, 1001, driver.SeverityWarning, "warning")
  failure := driver.NewLintDiagnostic(source, 0, 5, 1002, driver.SeverityError, "failure")
  if warning.Line != 1 || warning.Column != 1 || warning.Length == nil || *warning.Length != 1 {
    t.Fatalf("warning diagnostic location mismatch: %#v", warning)
  }
  if got := driver.CountErrors([]driver.Diagnostic{warning, failure, {Message: "plain"}}); got != 2 {
    t.Fatalf("error count mismatch: %d", got)
  }

  // Rendering assertion: diagnostics without raw anchors still get a stable
  // line-oriented fallback for callers that assemble plain messages.
  var out bytes.Buffer
  driver.WritePrettyDiagnostics(&out, []driver.Diagnostic{{File: "src/main.ts", Line: 2, Column: 4, Message: "plain"}}, root)
  if !strings.Contains(out.String(), "src/main.ts:2:4: plain") {
    t.Fatalf("plain diagnostic rendering mismatch:\n%s", out.String())
  }
}
