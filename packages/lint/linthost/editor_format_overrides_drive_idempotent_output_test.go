package linthost

import (
  "path/filepath"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestEditorFormatOverridesDriveIdempotentOutput verifies deterministic
// language precedence reaches the formatter's observable output and converges.
//
// Inspecting the options map alone cannot prove the LSP formatting path consumes
// the winning value. This scenario runs the default formatting resolver with a
// conflicting combined scope and exact TypeScript scope, then feeds its output
// through the same resolver again.
//
// 1. Configure four-space combined indentation and two-space TypeScript indentation.
// 2. Format a four-space-indented TypeScript statement to convergence.
// 3. Assert exact two-space output and a zero-edit second run.
//
// @evidence contracts/testing.md#behavioral-verification Writes a settings.json with `[javascript][typescript]` tabSize 4 and `[typescript]` tabSize 2, builds the default format resolver for typescript, formats a four-space-indented function through up to ten engine passes, and requires the exact two-space output, then formats that output again and requires zero applied edits.
// @evidence contracts/testing.md#independent-expectations The expected `function f() {\n  const value = 1;\n}\n` is an authored literal following from the exact section winning with tabSize 2; the zero-edit second run is a fixed-point check, not an independent oracle.
// @evidence contracts/testing.md#distinguishing-cases The input is indented to the losing combined value (4) so a resolver that preferred the combined scope would leave it unchanged; the second run distinguishes a converged result from one still being rewritten.
// @evidence contracts/testing.md#execution-ownership In-process Go unit: calls newFormatCommandResolver and the engine with applyFindingFixesToText on a parsed in-memory file and a temp-dir settings file; no command front door, VS Code, child process or installed consumer.
func TestEditorFormatOverridesDriveIdempotentOutput(t *testing.T) {
  root := t.TempDir()
  settings := `{
  "[javascript][typescript]": { "editor.tabSize": 4 },
  "[typescript]": { "editor.tabSize": 2 }
}`
  writeFile(t, filepath.Join(root, ".vscode", "settings.json"), settings)
  resolver, err := newFormatCommandResolver(RuleConfig{}, root, "typescript")
  if err != nil {
    t.Fatalf("newFormatCommandResolver: %v", err)
  }
  fileName := filepath.Join(root, "src", "main.ts")
  format := func(source string) (string, int) {
    t.Helper()
    total := 0
    for pass := 0; pass < 10; pass++ {
      file := parseTSFile(t, fileName, source)
      findings := filterFormatFindings(
        NewEngineWithResolver(resolver).Run([]*shimast.SourceFile{file}, nil),
      )
      next, applied := applyFindingFixesToText(source, findings)
      total += applied
      if applied == 0 {
        return source, total
      }
      source = next
    }
    t.Fatalf("formatter did not converge after 10 passes")
    return "", 0
  }

  expected := "function f() {\n  const value = 1;\n}\n"
  first, applied := format("function f() {\n    const value = 1;\n}\n")
  if applied == 0 {
    t.Fatalf("expected indentation rewrite")
  }
  if first != expected {
    t.Fatalf("formatted output mismatch:\nwant %q\ngot  %q", expected, first)
  }
  second, applied := format(first)
  if applied != 0 || second != first {
    t.Fatalf("format should be idempotent: applied=%d first=%q second=%q", applied, first, second)
  }
}
