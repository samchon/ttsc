package driver_test

import (
  "bytes"
  "path/filepath"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestMixedDiagnosticsRenderInSourceOrder verifies the public driver keeps
// a plugin finding ahead of a later compiler error after it separates the
// rich diagnostics into tsgo and lint slices for the shared renderer.
//
// 1. Load a program with a second-line type error.
// 2. Add a first-line lint diagnostic to the returned compiler diagnostics.
// 3. Assert pretty output follows source order across both producers.
func TestMixedDiagnosticsRenderInSourceOrder(t *testing.T) {
  root := t.TempDir()
  writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": { "module": "commonjs", "target": "es2020" },
  "files": ["index.ts"]
}
`)
  writeProjectFile(t, root, "index.ts", "const early = 1;\nconst later: number = 'wrong';\n")
  prog, configDiags, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{})
  if err != nil {
    t.Fatal(err)
  }
  if len(configDiags) != 0 {
    t.Fatalf("unexpected config diagnostics: %#v", configDiags)
  }
  defer prog.Close()
  compilerDiags := prog.Diagnostics()
  if len(compilerDiags) == 0 {
    t.Fatal("type error did not produce a compiler diagnostic")
  }
  source := prog.SourceFile(filepath.Join(root, "index.ts"))
  if source == nil {
    t.Fatal("source file not found")
  }
  diagnostics := append(compilerDiags, driver.NewLintDiagnostic(source, 6, 11, 9301, driver.SeverityError, "lint finding on the first line"))

  var rendered bytes.Buffer
  driver.WritePrettyDiagnostics(&rendered, diagnostics, root)
  output := rendered.String()
  lintIndex := strings.Index(output, "lint finding on the first line")
  compilerIndex := strings.Index(output, compilerDiags[0].Message)
  if lintIndex < 0 || compilerIndex < 0 {
    t.Fatalf("pretty render omitted a diagnostic:\n%s", output)
  }
  if lintIndex > compilerIndex {
    t.Fatalf("driver rich diagnostics retained producer order:\n%s", output)
  }
}
