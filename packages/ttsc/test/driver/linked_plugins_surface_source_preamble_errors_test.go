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

// TestDriverLinkedPluginsSurfaceSourcePreambleErrors Verifies that source
// preamble hook errors abort Program load.
//
// Source preambles are collected while the Program loads. A failing hook must
// fail the load rather than yield a Program built without its preamble.
//
//  1. Register a source-preamble plugin that returns an error.
//  2. Load a Program with one linked manifest entry.
//  3. Assert LoadProgram returns an error containing the hook's message (what
//     the parser saw is not observed).
//
// @evidence contracts/testing.md#behavioral-verification LoadProgram propagates the SourcePreamble failure message.
// @evidence contracts/testing.md#independent-expectations The injected hook returns the independent preamble failed sentinel.
// @evidence contracts/testing.md#distinguishing-cases One failing hook is covered; any partial Program is closed but its absence is not asserted.
// @evidence contracts/testing.md#execution-ownership Go unit TestDriverLinkedPluginsSurfaceSourcePreambleErrors is discovered by go test in test/driver and invokes source/shim operations directly. Temporary filesystem inputs do not install a consumer or build a host artifact.
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
