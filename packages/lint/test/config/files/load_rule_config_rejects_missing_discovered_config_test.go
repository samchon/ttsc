package linthost

import (
  "path/filepath"
  "strings"
  "testing"
)

// TestLoadRuleConfigRejectsMissingDiscoveredConfig verifies that passing an empty Config map
// without any lint config file present produces a clear error rather than a silent empty config.
//
// An empty config map triggers auto-discovery; if no lint.config.* or eslint.config.* file
// exists, the engine would run with zero rules and silently pass every project. The error must
// mention both "config" and "lint.config" so users understand what file to create.
//
// 1. Write only a tsconfig.json in the temp dir (no lint config file).
// 2. Call LoadRuleConfig with an empty Config map.
// 3. Assert an error is returned containing both "config" and "lint.config".
func TestLoadRuleConfigRejectsMissingDiscoveredConfig(t *testing.T) {
  dir := t.TempDir()
  writeFile(t, filepath.Join(dir, "tsconfig.json"), "{}")

  _, err := LoadRuleConfig(&PluginEntry{
    Config: map[string]any{},
  }, dir, "tsconfig.json")
  if err == nil {
    t.Fatal("expected missing lint config to fail")
  }
  if !strings.Contains(err.Error(), "config") || !strings.Contains(err.Error(), "lint.config") {
    t.Fatalf("error should explain required config discovery, got %v", err)
  }
}
