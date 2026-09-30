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
//
// @evidence contracts/testing.md#behavioral-verification LoadRuleConfig resolves the error severity from a co-located lint.config.json with an empty plugin-entry Config map.
// @evidence contracts/testing.md#independent-expectations Without configFile, recognized lint.config.* discovery is the default; the authored no-var/error map independently specifies the loaded severity.
// @evidence contracts/testing.md#distinguishing-cases Owns implicit JSON discovery with a populated rule; missing discovery and explicit override have separate cases.
// @evidence contracts/testing.md#execution-ownership This discoverable Go entry owns the case described above. A co-located authored JSON config reaches LoadRuleConfig through an empty plugin Config map in-process; resolved severity observes discovery without a script host or native producer.
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
