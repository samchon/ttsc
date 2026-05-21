package strip_test

import (
  "path/filepath"
  "testing"
)

// TestConfigDiscoversFileWalkingUpward verifies that the strip driver discovers
// strip.config.json by walking upward from the tsconfig directory.
//
// Locks the auto-discovery walk in findStripConfigFile: when no configFile key
// is present, the driver must search the tsconfig directory and each ancestor in
// order, stopping at the first directory with exactly one strip.config.* file.
//
//  1. Place a strip.config.json in a parent directory and a tsconfig.json in a
//     nested subdirectory (no strip.config.* in the subdirectory itself).
//  2. Call loadStripConfigMap with a plugin entry that has no configFile key,
//     pointing at the nested tsconfig.
//  3. Assert the returned config map reflects the parent-level config file.
func TestConfigDiscoversFileWalkingUpward(t *testing.T) {
  root := seedProject(t, map[string]string{
    "strip.config.json":        `{"calls":["console.warn"],"statements":[]}`,
    "nested/src/tsconfig.json": `{"compilerOptions":{"target":"ES2022"}}`,
  })
  config, err := stripLoadStripConfigMap(
    map[string]any{"transform": "@ttsc/strip"},
    filepath.Join(root, "nested", "src"),
    filepath.Join(root, "nested", "src", "tsconfig.json"),
  )
  if err != nil {
    t.Fatalf("loadStripConfigMap error: %v", err)
  }
  calls, ok := config["calls"].([]any)
  if !ok || len(calls) != 1 || calls[0] != "console.warn" {
    t.Fatalf("unexpected calls from ancestor config: %#v", config["calls"])
  }
}
