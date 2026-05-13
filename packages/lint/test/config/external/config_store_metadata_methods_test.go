package main

import "testing"

// TestConfigStoreMetadataMethods verifies external config store metadata accessors.
//
// ConfigStore is both a rule resolver and the marker that tells the command
// path whether ESLint runtime execution is wanted. Its metadata helpers must
// stay deterministic because collectDiagnostics branches on them.
//
// This scenario exercises the active-rule, enabled-rule, external path, and
// runtime marker methods without invoking the command wrapper.
//
// 1. Build a store with enabled, warning, off, and ignore-only entries.
// 2. Read the metadata methods used by Engine and external runtime dispatch.
// 3. Assert enabled rules exclude off values and runtime flags are preserved.
func TestConfigStoreMetadataMethods(t *testing.T) {
  store := &ConfigStore{
    externalConfigPath:    "/project/eslint.config.js",
    eslintRuntime:         true,
    eslintRuntimeRequired: true,
    entries: []ConfigEntry{
      {Rules: RuleConfig{"no-var": SeverityError, "no-console": SeverityWarn, "off-rule": SeverityOff}},
      {IgnoreOnly: true, Rules: RuleConfig{"ignored": SeverityError}},
    },
  }
  active := store.ActiveRuleNames()
  if len(active) != 2 || active[0] != "no-console" || active[1] != "no-var" {
    t.Fatalf("active rules mismatch: %v", active)
  }
  enabled := store.EnabledRuleConfig()
  if enabled.Severity("no-var") != SeverityError || enabled.Severity("no-console") != SeverityWarn || enabled.Severity("off-rule") != SeverityOff {
    t.Fatalf("enabled rule config mismatch: %+v", enabled)
  }
  if store.ExternalConfigPath() != "/project/eslint.config.js" || !store.WantsESLintRuntime() || !store.RequiresESLintRuntime() {
    t.Fatalf("runtime metadata mismatch")
  }
}
