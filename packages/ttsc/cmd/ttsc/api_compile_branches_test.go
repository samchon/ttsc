package main

import (
  "errors"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

type apiCompileApplyErrorPlugin struct{}

func (apiCompileApplyErrorPlugin) ApplyProgram(*driver.Program, driver.PluginContext) error {
  return errors.New("api compile apply boom")
}

// TestAPICompileBranches verifies api-compile handles parse, cwd, diagnostic, and emit failures.
//
// The JSON API path is used by the JS wrapper, so its command entrypoint must
// return stable status codes for wrapper misuse, project diagnostics, and
// linked transform failures.
//
// 1. Exercise bad flags and a failing cwd resolver.
// 2. Compile missing and type-invalid projects.
// 3. Assert linked ApplyProgram errors surface through the emit branch.
func TestAPICompileBranches(t *testing.T) {
  code, _, _ := captureCommand(t, func() int {
    return runAPICompile([]string{"--cwd"})
  })
  if code != 2 {
    t.Fatalf("bad flag status mismatch: %d", code)
  }

  code, _, errText := captureCommand(t, func() int {
    getwd = failGetwd
    return runAPICompile(nil)
  })
  if code != 2 || !strings.Contains(errText, "cwd boom") {
    t.Fatalf("cwd error mismatch: code=%d stderr=%q", code, errText)
  }

  root := t.TempDir()
  code, _, errText = captureCommand(t, func() int {
    return runAPICompile([]string{"--cwd", root, "--tsconfig", "missing.json"})
  })
  if code != 2 || !strings.Contains(errText, "tsconfig not found") {
    t.Fatalf("missing config mismatch: code=%d stderr=%q", code, errText)
  }

  writeCommandProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": { "module": "commonjs", "target": "es2020", "strict": true },
  "files": ["index.ts"]
}
`)
  writeCommandProjectFile(t, root, "index.ts", `const value: number = "text";
export { value };
`)
  code, out, _ := captureCommand(t, func() int {
    return runAPICompile([]string{"--cwd", root, "--tsconfig", "tsconfig.json"})
  })
  if code != 2 || !strings.Contains(out, `"diagnostics"`) {
    t.Fatalf("diagnostic compile mismatch: code=%d stdout=%q", code, out)
  }
  if got := toAPICompileDiagnostic(driver.Diagnostic{Severity: driver.SeverityWarning}).Category; got != "warning" {
    t.Fatalf("warning category mismatch: %q", got)
  }

  resetCommandLinkedPluginRegistry()
  driver.RegisterPlugin(apiCompileApplyErrorPlugin{})
  t.Setenv(driver.LinkedPluginsEnv, `[{"name":"error","stage":"transform","config":{}}]`)
  writeCommandProjectFile(t, root, "index.ts", `export const value = 1;
`)
  code, _, errText = captureCommand(t, func() int {
    return runAPICompile([]string{"--cwd", root, "--tsconfig", "tsconfig.json"})
  })
  if code != 3 || !strings.Contains(errText, "api compile apply boom") {
    t.Fatalf("emit error mismatch: code=%d stderr=%q", code, errText)
  }
}
