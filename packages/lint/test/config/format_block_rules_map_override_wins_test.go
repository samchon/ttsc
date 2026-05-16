package main

import "testing"

// TestFormatBlockRulesMapOverrideWins verifies that a `rules` entry
// for a `format/*` rule takes precedence over whatever the `format`
// block expanded for the same rule.
//
// `rules`-wins is the documented per-rule escape hatch: a user who
// wants `format/semi` at error but the rest at warning writes
//
//  format: { severity: "warning" },
//  rules: { "format/semi": "error" },
//
// and expects the override to land. A regression that ordered the
// merge the other way would leave the user's explicit override
// silently shadowed by the block's default.
//
//  1. Build an entry with `format: {}` (default-warning) and
//     `rules: { "format/semi": "error" }`.
//  2. Resolve.
//  3. Assert format/semi severity is "error" and the other format
//     rules remain at "warning".
func TestFormatBlockRulesMapOverrideWins(t *testing.T) {
  entry := &PluginEntry{
    Config: map[string]any{
      "format": map[string]any{},
      "rules": map[string]any{
        "format/semi": "error",
      },
    },
  }
  resolver, err := LoadConfigResolver(entry, "/virtual", "")
  if err != nil {
    t.Fatalf("LoadConfigResolver: %v", err)
  }
  enabled := resolver.EnabledRuleConfig()
  if got := enabled["format/semi"]; got != SeverityError {
    t.Errorf("format/semi want error, got %v", got)
  }
  if got := enabled["format/quotes"]; got != SeverityWarn {
    t.Errorf("format/quotes want warning, got %v", got)
  }
}
