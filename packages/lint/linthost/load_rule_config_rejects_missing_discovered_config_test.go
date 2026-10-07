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
//
// @evidence contracts/testing.md#behavioral-verification LoadRuleConfig rejects missing automatic discovery and explains both the lint.config naming route and explicit configFile alternative.
// @evidence contracts/testing.md#independent-expectations A missing required lint config must not silently run an empty rule set; the literal remediation terms establish user-facing diagnostic meaning.
// @evidence contracts/testing.md#distinguishing-cases Owns a tsconfig-only tree with no candidate; a co-located recognized config is the positive counterpart.
// @evidence contracts/testing.md#execution-ownership This discoverable Go entry owns the case described above. A temporary tsconfig-only tree reaches LoadRuleConfig directly in-process; the error and literal remediation vocabulary establish missing-config handling without any child evaluator.
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
