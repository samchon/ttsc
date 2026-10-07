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

// TestDriverLinkedPluginsSurfaceApplyProgramErrors Verifies that ApplyLinkedPlugins surfaces the synthetic ApplyProgram error containing apply boom.
//
// A successful project load precedes program-hook failure; preamble failures have separate coverage.
//
// 1. Register a linked plugin whose ApplyProgram returns an error.
// 2. Load a real Program with one linked manifest entry.
// 3. Assert ApplyLinkedPlugins returns the plugin error text.
//
// @evidence contracts/testing.md#behavioral-verification ApplyLinkedPlugins surfaces the synthetic ApplyProgram error containing apply boom.
// @evidence contracts/testing.md#independent-expectations The test plugin returns a fixed error independently of the host.
// @evidence contracts/testing.md#distinguishing-cases A successful project load precedes program-hook failure; preamble failures have separate coverage.
// @evidence contracts/testing.md#execution-ownership A registered Go plugin executes against the directly loaded Program without a sidecar. Go discovers TestDriverLinkedPluginsSurfaceApplyProgramErrors under ./test/driver.
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
