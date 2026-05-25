package linthost

import (
  "path/filepath"
  "testing"
)

// TestLoadRuleConfigDiscoversPlainLintConfig verifies the discovery path when the PluginEntry
// has no `configFile` key: LoadRuleConfig should find the nearest lint.config.* file.
//
// When a host passes an empty Config map, there is no explicit `configFile` pointer.
// LoadRuleConfig must fall back to findLintConfigFile discovery rather than fail. This path is
// the default for projects that keep their lint config beside tsconfig.json.
//
// 1. Write tsconfig.json and lint.config.json (an ITtscLintConfig object) in a temp dir.
// 2. Call LoadRuleConfig with an empty Config map.
// 3. Assert the discovered config's rule is resolved correctly.
func TestLoadRuleConfigDiscoversPlainLintConfig(t *testing.T) {
  dir := t.TempDir()
  writeFile(t, filepath.Join(dir, "tsconfig.json"), "{}")
  writeFile(t, filepath.Join(dir, "lint.config.json"), `{
    "rules": { "no-var": "error" }
  }`)

  cfg, err := LoadRuleConfig(&PluginEntry{
    Config: map[string]any{},
  }, dir, "tsconfig.json")
  if err != nil {
    t.Fatalf("LoadRuleConfig: %v", err)
  }
  if cfg.Severity("no-var") != SeverityError {
    t.Errorf("noVar: want error, got %v", cfg.Severity("no-var"))
  }
}
