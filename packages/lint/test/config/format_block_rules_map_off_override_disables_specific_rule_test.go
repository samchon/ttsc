package linthost

import "testing"

// TestFormatBlockRulesMapOffOverrideDisablesSpecificRule verifies that
// `rules: { "formatQuotes": "off" }` zeros only that one rule while the
// explicitly warning `format` block stays enabled for the other rules.
//
// This pins row 4 of the design spec's conflict-resolution table
// (`format` present + `rules` entry "off"). The matching row 5 of
// the table — `rules` entry with options tuple — has its own peer
// in `format_block_rules_map_tuple_override_wins_test.go`.
//
//  1. Build a `format: { severity: "warning" }` block.
//  2. Add `rules: { "formatQuotes": "off" }`.
//  3. Assert formatQuotes is missing from `EnabledRuleConfig()` while
//     every other always-on format rule is still warning.
func TestFormatBlockRulesMapOffOverrideDisablesSpecificRule(t *testing.T) {
  resolver, err := parseExternalConfigStore(map[string]any{
    "format": map[string]any{"severity": "warning"},
    "rules": map[string]any{
      "formatQuotes": "off",
    },
  }, "")
  if err != nil {
    t.Fatalf("parseExternalConfigStore: %v", err)
  }
  enabled := resolver.EnabledRuleConfig()
  if _, ok := enabled["formatQuotes"]; ok {
    t.Errorf("expected formatQuotes disabled, got %v", enabled["formatQuotes"])
  }
  for _, name := range []string{
    "formatSemi",
    "formatTrailingComma",
    "formatPrintWidth",
  } {
    if got, ok := enabled[name]; !ok || got != SeverityWarn {
      t.Errorf("expected %q at warning, got %v (ok=%t)", name, got, ok)
    }
  }
}
