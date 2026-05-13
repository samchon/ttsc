package main

import (
  "path/filepath"
  "testing"
)

// TestLoadRuleConfigAcceptsTopLevelRulesField verifies the supported
// inline-rules contract: a tsconfig plugin entry with a top-level
// `rules` map is decoded as the resolver's enabled rule set.
//
// LoadRuleConfig bridges plugin JSON, discovered config files, and
// explicit config paths. Until 0.10.2 this slot was named `config` and
// the same payload at the top level (`rules: { ... }`) was rejected.
// The supported contract is now the inverse — `rules` is the inline
// severity map and the legacy `config` shape lives behind a deprecation
// notice. This case pins the positive resolve so a regression cannot
// reintroduce the old rejection.
//
// 1. Materialize a tsconfig at the project root.
// 2. Pass a plugin entry whose `Config` carries an inline `rules` map.
// 3. Assert the rule resolves to the configured severity.
func TestLoadRuleConfigAcceptsTopLevelRulesField(t *testing.T) {
  dir := t.TempDir()
  writeFile(t, filepath.Join(dir, "tsconfig.json"), "{}")

  rules, err := LoadRuleConfig(&PluginEntry{
    Config: map[string]any{
      "rules": map[string]any{
        "no-var": "warn",
      },
    },
  }, dir, "tsconfig.json")
  if err != nil {
    t.Fatalf("expected top-level rules to be accepted, got %v", err)
  }
  if got := rules.Severity("no-var"); got != SeverityWarn {
    t.Fatalf("want no-var = warn, got %v", got)
  }
}
