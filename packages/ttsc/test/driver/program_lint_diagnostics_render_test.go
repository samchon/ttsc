package driver_test

import (
  "bytes"
  "path/filepath"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestProgramLintDiagnosticsRender verifies driver diagnostics render
// lint-backed entries.
//
// Lint diagnostics use a separate shim object from tsgo diagnostics, but both
// pass through WritePrettyDiagnostics. This keeps mixed diagnostic rendering
// from silently dropping plugin findings.
//
// 1. Load a one-file program.
// 2. Create a lint diagnostic against its source file.
// 3. Assert the pretty renderer includes the lint message.
func TestProgramLintDiagnosticsRender(t *testing.T) {
  root := t.TempDir()
  writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": { "module": "commonjs", "target": "es2020" },
  "files": ["index.ts"]
}
`)
  writeProjectFile(t, root, "index.ts", `export const value = 1;
`)
  prog, diags, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{})
  if err != nil {
    t.Fatal(err)
  }
  if len(diags) != 0 {
    t.Fatalf("unexpected config diagnostics: %#v", diags)
  }
  defer prog.Close()
  source := prog.SourceFile(filepath.Join(root, "index.ts"))
  if source == nil {
    t.Fatal("source file not found")
  }

  var out bytes.Buffer
  diag := driver.NewLintDiagnostic(source, 0, 6, 7001, driver.SeverityWarning, "lint says no")
  driver.WritePrettyDiagnostics(&out, []driver.Diagnostic{diag}, root)
  if !strings.Contains(out.String(), "lint says no") {
    t.Fatalf("lint diagnostic missing:\n%s", out.String())
  }
}
