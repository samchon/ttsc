package driver_test

import (
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestDriverLinkedPluginsRejectMissingRegistration verifies that manifest
// entries require matching registrations.
//
// A non-main transform package is included by blank import. If the manifest
// lists an entry but no linked package registered at that position, ttsc must
// fail loudly instead of silently dropping the transform.
//
// 1. Load a project with one linked plugin manifest entry and no registrations.
// 2. Observe source-preamble collection during Program load.
// 3. Assert the error explains that no linked plugin registered.
func TestDriverLinkedPluginsRejectMissingRegistration(t *testing.T) {
  resetLinkedPluginRegistry()
  t.Setenv(driver.LinkedPluginsEnv, `[{"name":"missing","stage":"transform","config":{}}]`)
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
  if err == nil || !strings.Contains(err.Error(), "no linked plugin registered") {
    t.Fatalf("expected missing registration error, got %v", err)
  }
}
