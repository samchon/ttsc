package main

import "testing"

// TestConfigStoreMetadataDefaultsAndESLintFilename verifies metadata edge cases.
//
// ConfigStore metadata decides whether the native engine can stay self-hosted
// or must delegate to ESLint. Nil stores should behave like empty native
// config, while discovered eslint.config files should request optional runtime.
//
// This scenario also covers enabled-rule precedence where an error severity
// should not be downgraded by a later warning entry for the same rule.
//
// 1. Assert nil metadata methods return empty native defaults.
// 2. Build an eslint.config-backed store without an explicit runtime marker.
// 3. Assert runtime inference and enabled-rule precedence are stable.
func TestConfigStoreMetadataDefaultsAndESLintFilename(t *testing.T) {
  var missing *ConfigStore
  if missing.ExternalConfigPath() != "" || missing.WantsESLintRuntime() || missing.RequiresESLintRuntime() {
    t.Fatalf("nil metadata should be empty native defaults")
  }
  if names := missing.ActiveRuleNames(); len(names) != 0 {
    t.Fatalf("nil active rules should be empty, got %v", names)
  }
  if cfg := missing.EnabledRuleConfig(); len(cfg) != 0 {
    t.Fatalf("nil enabled config should be empty, got %+v", cfg)
  }

  store := &ConfigStore{
    externalConfigPath: "/repo/eslint.config.cjs",
    entries: []ConfigEntry{
      {Rules: RuleConfig{"no-var": SeverityError}},
      {Rules: RuleConfig{"no-var": SeverityWarn, "eqeqeq": SeverityWarn}},
    },
  }
  if !store.WantsESLintRuntime() || store.RequiresESLintRuntime() {
    t.Fatalf("eslint.config should want optional runtime only")
  }
  enabled := store.EnabledRuleConfig()
  if enabled.Severity("no-var") != SeverityError || enabled.Severity("eqeqeq") != SeverityWarn {
    t.Fatalf("enabled precedence mismatch: %+v", enabled)
  }
}
