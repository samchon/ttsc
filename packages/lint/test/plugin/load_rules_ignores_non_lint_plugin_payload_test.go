package main

import "testing"

// TestLoadRulesIgnoresNonLintPluginPayload verifies unknown plugin entries are inert.
//
// Disabled plugins are filtered by the host before the sidecar receives
// --plugins-json, so the lint binary must treat payloads without @ttsc/lint as
// an empty rule set. Other plugin descriptors should not trigger discovery.
//
// This scenario exercises ParsePlugins, FindLintEntry, and loadRules through a
// payload containing only unrelated or disabled-looking plugin descriptors.
//
// 1. Build a plugins-json payload without an @ttsc/lint entry.
// 2. Load rules through the command helper.
// 3. Assert the resulting resolver has no enabled rules.
func TestLoadRulesIgnoresNonLintPluginPayload(t *testing.T) {
  rules, err := loadRules(`[
    {"name":"@ttsc/banner","stage":"transform","config":{}},
    {"name":"disabled","stage":"check","config":{"enabled":false}}
  ]`, t.TempDir(), "tsconfig.json")
  if err != nil {
    t.Fatalf("loadRules: %v", err)
  }
  if enabled := rules.EnabledRuleConfig(); len(enabled) != 0 {
    t.Fatalf("non-lint payload should not enable rules, got %+v", enabled)
  }
}
