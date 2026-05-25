package linthost

import "testing"

// TestFormatBlockRulesMapOverrideWins verifies that a `rules` entry
// for a `format/*` rule takes precedence over whatever the `format`
// block expanded for the same rule.
//
// `rules`-wins is the documented per-rule escape hatch: a user who
// wants to override `format/semi` writes a sibling `rules` entry and
// expects the override to land. A regression that ordered the
// merge the other way would leave the user's explicit override
// silently shadowed by the block's default.
//
//  1. Build an entry with `format: { severity: "warning" }` and
//     `rules: { "format/semi": "error" }`.
//  2. Parse it through `parseExternalConfigStore`.
//  3. Assert formatSemi uses the explicit rule entry and the other format
//     rules remain warnings.
func TestFormatBlockRulesMapOverrideWins(t *testing.T) {
  resolver, err := parseExternalConfigStore(map[string]any{
    "format": map[string]any{"severity": "warning"},
    "rules": map[string]any{
      "format/semi": "error",
    },
  }, "")
  if err != nil {
    t.Fatalf("parseExternalConfigStore: %v", err)
  }
  enabled := resolver.EnabledRuleConfig()
  if got := enabled["format/semi"]; got != SeverityError {
    t.Errorf("formatSemi want error, got %v", got)
  }
  if got := enabled["format/quotes"]; got != SeverityWarn {
    t.Errorf("formatQuotes want warning, got %v", got)
  }
}
