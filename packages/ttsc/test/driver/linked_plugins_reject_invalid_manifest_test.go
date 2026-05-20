package driver_test

import (
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestDriverLinkedPluginsRejectInvalidManifest verifies that invalid manifest
// JSON fails during Program load.
//
// The linked plugin manifest enters the Go host through an environment
// variable. Invalid JSON must stop Program creation before emit or transform
// hooks can run with an empty plugin list.
//
// 1. Set TTSC_LINKED_PLUGINS_JSON to malformed JSON.
// 2. Load a real tsconfig project.
// 3. Assert the returned error names the invalid manifest variable.
func TestDriverLinkedPluginsRejectInvalidManifest(t *testing.T) {
  resetLinkedPluginRegistry()
  t.Setenv(driver.LinkedPluginsEnv, `{`)
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
  if err == nil || !strings.Contains(err.Error(), driver.LinkedPluginsEnv) {
    t.Fatalf("expected invalid linked manifest error, got %v", err)
  }
}
