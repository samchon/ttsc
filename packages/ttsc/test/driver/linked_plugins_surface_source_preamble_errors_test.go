package driver_test

import (
  "errors"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

type linkedPreambleErrorPlugin struct{}

func (linkedPreambleErrorPlugin) SourcePreamble(driver.PluginContext) (string, error) {
  return "", errors.New("preamble failed")
}

// TestDriverLinkedPluginsSurfaceSourcePreambleErrors verifies that source
// preamble hook errors abort Program load.
//
// Source preambles are applied before TypeScript-Go parses source text. A
// failing hook must stop the load immediately so the parser never sees a
// partial synthetic prefix.
//
// 1. Register a source-preamble plugin that returns an error.
// 2. Load a Program with one linked manifest entry.
// 3. Assert the error is surfaced to the caller.
func TestDriverLinkedPluginsSurfaceSourcePreambleErrors(t *testing.T) {
  resetLinkedPluginRegistry()
  driver.RegisterPlugin(linkedPreambleErrorPlugin{})
  t.Setenv(driver.LinkedPluginsEnv, `[{"name":"bad","stage":"transform","config":{}}]`)
  root := t.TempDir()
  writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": { "module": "commonjs", "target": "es2020" },
  "files": ["index.ts"]
}
`)
  writeProjectFile(t, root, "index.ts", `export const value = 1;
`)

  prog, _, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{})
  if prog != nil {
    _ = prog.Close()
  }
  if err == nil || !strings.Contains(err.Error(), "preamble failed") {
    t.Fatalf("expected preamble hook error, got %v", err)
  }
}
