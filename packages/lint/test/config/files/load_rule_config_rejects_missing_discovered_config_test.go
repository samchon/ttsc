package linthost

import (
  "path/filepath"
  "strings"
  "testing"
)

// TestLoadRuleConfigRejectsMissingDiscoveredConfig verifies that an empty Config map with no
// lint config file present produces a clear error rather than a silent empty config.
//
// An empty Config map triggers auto-discovery; if no lint.config.* or ttsc-lint.config.* file
// exists, the engine would run with zero rules and silently pass every project. The error must
// point the user at creating a config file or setting "configFile".
//
// 1. Write only a tsconfig.json in the temp dir (no lint config file).
// 2. Call LoadRuleConfig with an empty Config map.
// 3. Assert an error is returned mentioning both "lint.config" and "configFile".
func TestLoadRuleConfigRejectsMissingDiscoveredConfig(t *testing.T) {
  dir := t.TempDir()
  writeFile(t, filepath.Join(dir, "tsconfig.json"), "{}")

  _, err := LoadRuleConfig(&PluginEntry{
    Config: map[string]any{},
  }, dir, "tsconfig.json")
  if err == nil {
    t.Fatal("expected missing lint config to fail")
  }
  if !strings.Contains(err.Error(), "lint.config") || !strings.Contains(err.Error(), "configFile") {
    t.Fatalf("error should explain required config discovery, got %v", err)
  }
}
