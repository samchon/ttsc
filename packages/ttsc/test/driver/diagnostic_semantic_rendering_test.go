package driver_test

import (
  "bytes"
  "path/filepath"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestDriverDiagnosticSemanticRendering verifies tsgo diagnostics retain rich
// source anchors after conversion.
//
// This exercises the raw diagnostic branch used by CountErrors and
// WritePrettyDiagnostics, including the empty diagnostic no-op path.
//
// 1. Load a real project containing a semantic type error.
// 2. Convert diagnostics through the public Program facade.
// 3. Assert location, counting, and pretty rendering remain observable.
func TestDriverDiagnosticSemanticRendering(t *testing.T) {
  root := t.TempDir()
  writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": {
    "module": "commonjs",
    "target": "es2020",
    "strict": true
  },
  "files": ["index.ts"]
}
`)
  writeProjectFile(t, root, "index.ts", `const value: number = "text";
export { value };
`)
  prog, configDiags, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{ForceNoEmit: true})
  if err != nil {
    t.Fatal(err)
  }
  if len(configDiags) != 0 {
    t.Fatalf("unexpected config diagnostics: %#v", configDiags)
  }
  defer prog.Close()

  var empty bytes.Buffer
  driver.WritePrettyDiagnostics(&empty, nil, root)
  if empty.Len() != 0 {
    t.Fatalf("empty diagnostic render should be silent: %q", empty.String())
  }

  diags := prog.Diagnostics()
  if len(diags) == 0 {
    t.Fatal("semantic error should produce diagnostics")
  }
  first := diags[0]
  if !strings.HasSuffix(filepath.ToSlash(first.File), "index.ts") || first.Line == 0 || first.Column == 0 || first.Start == nil || first.Length == nil {
    t.Fatalf("semantic diagnostic location mismatch: %#v", first)
  }
  if got := driver.CountErrors(diags); got == 0 {
    t.Fatalf("semantic diagnostics should count as errors: %#v", diags)
  }
  var out bytes.Buffer
  driver.WritePrettyDiagnostics(&out, diags, root)
  if out.Len() == 0 || !strings.Contains(out.String(), "number") {
    t.Fatalf("semantic diagnostics did not render useful text:\n%s", out.String())
  }
}
