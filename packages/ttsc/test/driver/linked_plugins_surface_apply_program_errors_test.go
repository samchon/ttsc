package driver_test

import (
  "errors"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

type linkedApplyErrorPlugin struct{}

func (linkedApplyErrorPlugin) ApplyProgram(*driver.Program, driver.PluginContext) error {
  return errors.New("apply boom")
}

// TestDriverLinkedPluginsSurfaceApplyProgramErrors verifies that ApplyProgram
// errors surface unchanged.
//
// The generic linked host must not swallow package-owned transform failures.
// This pins the ProgramPlugin error branch separately from source-preamble
// errors so either hook can fail with its own message.
//
// 1. Register a linked plugin whose ApplyProgram returns an error.
// 2. Load a real Program with one linked manifest entry.
// 3. Assert ApplyLinkedPlugins returns the plugin error text.
func TestDriverLinkedPluginsSurfaceApplyProgramErrors(t *testing.T) {
  resetLinkedPluginRegistry()
  t.Setenv(driver.LinkedPluginsEnv, `[{"name":"apply-error","stage":"transform","config":{}}]`)
  driver.RegisterPlugin(linkedApplyErrorPlugin{})

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
    t.Fatalf("unexpected diagnostics: %#v", diags)
  }
  defer prog.Close()

  err = prog.ApplyLinkedPlugins()
  if err == nil || !strings.Contains(err.Error(), "apply boom") {
    t.Fatalf("expected ApplyProgram error, got %v", err)
  }
}
