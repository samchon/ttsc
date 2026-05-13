package main

import (
  "testing"
)

// TestLoadRuleConfigAcceptsInlineConfigObject verifies inline config loading.
//
// LoadRuleConfig bridges plugin JSON, discovered config files, and explicit config paths. These
// tests materialize temporary config files so path resolution and legacy-key rejection are
// checked with real filesystem behavior.
//
// This scenario focuses on load rule config accepts inline config object. It ensures the lint
// package accepts only the supported config contract while still loading JSON, JavaScript, and
// TypeScript config files through the documented path.
//
// 1. Create the temporary tsconfig and lint config files required by the branch.
// 2. Load the rule config through the package helper used by command execution.
// 3. Assert resolved severities or the precise rejection message.
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
