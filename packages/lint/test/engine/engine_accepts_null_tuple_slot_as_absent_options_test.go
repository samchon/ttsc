package linthost

import "testing"

// TestEngineAcceptsNullTupleSlotAsAbsentOptions verifies the parser's null-slot
// compatibility boundary reaches the runtime options gate unchanged.
//
// A two-slot `[severity, null]` setting is intentionally normalized to no
// options, matching existing config behavior. It must not be mistaken for a
// real payload and rejected on an optionless rule.
//
//  1. Parse `no-var: ["error", null]` through the standard rules parser.
//  2. Bind the parsed maps into an inline resolver.
//  3. Assert the optionless rule remains valid and enabled.
func TestEngineAcceptsNullTupleSlotAsAbsentOptions(t *testing.T) {
  rules, options, err := ParseRulesWithOptions(map[string]any{
    "no-var": []any{"error", nil},
  })
  if err != nil {
    t.Fatal(err)
  }
  engine := NewEngineWithResolver(InlineRuleResolver{Rules: rules, Options: options})
  if err := engine.ConfigError(); err != nil {
    t.Fatalf("null tuple slot was treated as an options payload: %v", err)
  }
  if engine.EnabledRules()["no-var"] != SeverityError {
    t.Fatalf("no-var was not enabled after null-slot normalization: %v", engine.EnabledRules())
  }
}
