package main

import (
  "encoding/json"
  "testing"
)

// TestFormatBlockRulesMapTupleOverrideWins verifies that an option
// tuple in the `rules` map fully replaces the matching entry from the
// `format` block — both severity AND options are taken from the
// rules entry.
//
// This pins row 5 of the design spec's conflict-resolution table.
// The format block expansion produces a tuple-shaped entry per rule;
// a user-supplied tuple in `rules` must overwrite that entry
// wholesale (no deep merge of option objects). A regression that
// deep-merged the option blob would silently mix the two surfaces
// in a way the spec rules out.
//
//  1. Build `format: { printWidth: 80 }` (default options).
//  2. Override via `rules: { "format/print-width": ["error", { "printWidth": 120 }] }`.
//  3. Assert the resolved options carry `printWidth=120`, not 80.
func TestFormatBlockRulesMapTupleOverrideWins(t *testing.T) {
  entry := &PluginEntry{
    Config: map[string]any{
      "format": map[string]any{"printWidth": 80},
      "rules": map[string]any{
        "format/print-width": []any{
          "error",
          map[string]any{"printWidth": 120},
        },
      },
    },
  }
  resolver, err := LoadConfigResolver(entry, "/virtual", "")
  if err != nil {
    t.Fatalf("LoadConfigResolver: %v", err)
  }
  if got := resolver.EnabledRuleConfig()["format/print-width"]; got != SeverityError {
    t.Errorf("severity want error, got %v", got)
  }
  type pwOpts struct {
    PrintWidth int `json:"printWidth"`
  }
  var pw pwOpts
  if err := json.Unmarshal(resolver.RuleOptions("format/print-width"), &pw); err != nil {
    t.Fatalf("decode options: %v", err)
  }
  if pw.PrintWidth != 120 {
    t.Errorf("printWidth want 120 (rules override), got %d", pw.PrintWidth)
  }
}
