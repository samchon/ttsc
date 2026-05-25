package linthost

import (
  "path/filepath"
  "testing"
)

// TestLoadRuleConfigResolvesLinearExtendsChain verifies that a valid, acyclic
// `extends` chain still merges rules in the documented order.
//
// The cycle/depth guard must not regress legitimate inheritance: the
// extends-target's entries are appended first so the extending file's own
// rules win on collision. This pins that a base file's rules are inherited and
// that a local override outranks the inherited severity.
//
//  1. Write a base `b.config.json` (`noVar: warning`, `eqeqeq: error`).
//  2. Write `a.config.json` that `extends` it and re-declares `noVar: error`.
//  3. Call LoadRuleConfig and assert `eqeqeq` is inherited and the local
//     `noVar: error` override wins over the base `warning`.
func TestLoadRuleConfigResolvesLinearExtendsChain(t *testing.T) {
  dir := t.TempDir()
  writeFile(t, filepath.Join(dir, "tsconfig.json"), "{}")
  writeFile(t, filepath.Join(dir, "b.config.json"), `{
    "rules": { "noVar": "warning", "eqeqeq": "error" }
  }`)
  writeFile(t, filepath.Join(dir, "a.config.json"), `{
    "extends": "./b.config.json",
    "rules": { "noVar": "error" }
  }`)

  cfg, err := LoadRuleConfig(&PluginEntry{
    Config: map[string]any{
      "configFile": "./a.config.json",
    },
  }, dir, "tsconfig.json")
  if err != nil {
    t.Fatalf("LoadRuleConfig: %v", err)
  }
  if cfg.Severity("eqeqeq") != SeverityError {
    t.Errorf("eqeqeq: want error inherited from base, got %v", cfg.Severity("eqeqeq"))
  }
  if cfg.Severity("noVar") != SeverityError {
    t.Errorf("noVar: want error from local override, got %v", cfg.Severity("noVar"))
  }
}
