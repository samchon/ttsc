package linthost

import (
  "encoding/json"
  "testing"
)

// TestFormatBlockRulesMapTupleOverrideWins verifies that an option
// tuple in the `rules` map fully replaces the matching entry from the
// `format` block.
//
// This pins row 5 of the design spec's conflict-resolution table.
// The format block expansion produces a tuple-shaped entry per rule;
// a user-supplied tuple in `rules` must overwrite that entry
// wholesale (no deep merge of option objects). A regression that
// deep-merged the option blob would silently mix the two surfaces
// in a way the spec rules out.
//
//  1. Build `format: { severity: "warning", printWidth: 80 }`.
//  2. Override via `rules: { "formatPrintWidth": ["error", { "printWidth": 120 }] }`.
//  3. Assert the resolved options carry `printWidth=120`, not 80.
func TestFormatBlockRulesMapTupleOverrideWins(t *testing.T) {
  resolver, err := parseExternalConfigStore(map[string]any{
    "format": map[string]any{"severity": "warning", "printWidth": 80},
    "rules": map[string]any{
      "formatPrintWidth": []any{
        "error",
        map[string]any{"printWidth": 120},
      },
    },
  }, "")
  if err != nil {
    t.Fatalf("parseExternalConfigStore: %v", err)
  }
  if got := resolver.EnabledRuleConfig()["formatPrintWidth"]; got != SeverityError {
    t.Errorf("severity want error, got %v", got)
  }
  type pwOpts struct {
    PrintWidth int `json:"printWidth"`
  }
  var pw pwOpts
  if err := json.Unmarshal(resolver.RuleOptions("formatPrintWidth"), &pw); err != nil {
    t.Fatalf("decode options: %v", err)
  }
  if pw.PrintWidth != 120 {
    t.Errorf("printWidth want 120 (rules override), got %d", pw.PrintWidth)
  }
}
