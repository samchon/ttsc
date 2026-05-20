package linthost

import (
  "testing"
)

// TestLoadRuleConfigAcceptsInlineConfigObject verifies that a PluginEntry with a nested
// `config` object (rather than a file path) is accepted as the inline config form.
//
// Some hosts embed the full rule map directly in the plugin descriptor's `Config` field under
// the `config` key. LoadRuleConfig must treat that as a direct rule object, bypassing file
// discovery. Without this path, embedded configs would fail with a missing-file error.
//
// 1. Build a PluginEntry whose Config carries `config: { "no-var": "error" }`.
// 2. Call LoadRuleConfig with a temp dir and a tsconfig name.
// 3. Assert no-var resolves to SeverityError without touching the filesystem.
func TestLoadRuleConfigAcceptsInlineConfigObject(t *testing.T) {
  cfg, err := LoadRuleConfig(&PluginEntry{
    Config: map[string]any{
      "config": map[string]any{
        "no-var": "error",
      },
    },
  }, t.TempDir(), "tsconfig.json")
  if err != nil {
    t.Fatalf("LoadRuleConfig: %v", err)
  }
  if cfg.Severity("no-var") != SeverityError {
    t.Errorf("no-var: want error, got %v", cfg.Severity("no-var"))
  }
}
