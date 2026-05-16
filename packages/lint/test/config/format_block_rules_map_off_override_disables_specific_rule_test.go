package main

import "testing"

// TestFormatBlockRulesMapOffOverrideDisablesSpecificRule verifies that
// `rules: { "format/quotes": "off" }` zeros only that one rule while
// the rest of the `format` block stays at its default severity.
//
// This pins row 4 of the design spec's conflict-resolution table
// (`format` present + `rules` entry "off"). The matching row 5 of
// the table — `rules` entry with options tuple — has its own peer
// in `format_block_rules_map_tuple_override_wins_test.go`.
//
//  1. Build a `format: {}` block with the default severity.
//  2. Add `rules: { "format/quotes": "off" }`.
//  3. Assert format/quotes is missing from `EnabledRuleConfig()` while
//     every other always-on format rule is still warning.
func TestFormatBlockRulesMapOffOverrideDisablesSpecificRule(t *testing.T) {
  entry := &PluginEntry{
    Config: map[string]any{
      "format": map[string]any{},
      "rules": map[string]any{
        "format/quotes": "off",
      },
    },
  }
  resolver, err := LoadConfigResolver(entry, "/virtual", "")
  if err != nil {
    t.Fatalf("LoadConfigResolver: %v", err)
  }
  enabled := resolver.EnabledRuleConfig()
  if _, ok := enabled["format/quotes"]; ok {
    t.Errorf("expected format/quotes disabled, got %v", enabled["format/quotes"])
  }
  for _, name := range []string{
    "format/semi",
    "format/trailing-comma",
    "format/print-width",
  } {
    if got, ok := enabled[name]; !ok || got != SeverityWarn {
      t.Errorf("expected %q at warning, got %v (ok=%t)", name, got, ok)
    }
  }
}
