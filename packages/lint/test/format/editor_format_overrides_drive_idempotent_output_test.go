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
