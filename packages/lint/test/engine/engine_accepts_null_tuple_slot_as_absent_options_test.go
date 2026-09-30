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
//
// @evidence contracts/testing.md#behavioral-verification ParseRulesWithOptions normalizes an explicit null tuple slot to absent options, allowing optionless no-var to bind at error severity.
// @evidence contracts/testing.md#independent-expectations The literal [error,null] compatibility input independently requires no option payload, no configuration error and the canonical active rule.
// @evidence contracts/testing.md#distinguishing-cases Explicit null contrasts omitted severity-only options and nonnull object/scalar/array rejection cases.
// @evidence contracts/testing.md#execution-ownership The real rules parser feeds InlineRuleResolver and NewEngineWithResolver in one Go process; this individual entry observes both decoded maps and engine acceptance without reading or launching a consumer.
func TestEngineAcceptsNullTupleSlotAsAbsentOptions(t *testing.T) {
  rules, options, err := ParseRulesWithOptions(map[string]any{
    "no-var": []any{"error", nil},
  })
  if err != nil {
    t.Fatal(err)
  }
  if rules["no-var"] != SeverityError || len(rules) != 1 || len(options) != 0 {
    t.Fatalf("null slot did not preserve severity-only configuration: rules=%v options=%v", rules, options)
  }
  engine := NewEngineWithResolver(InlineRuleResolver{Rules: rules, Options: options})
  if err := engine.ConfigError(); err != nil {
    t.Fatalf("null tuple slot was treated as an options payload: %v", err)
  }
  if engine.EnabledRules()["no-var"] != SeverityError {
    t.Fatalf("no-var was not enabled after null-slot normalization: %v", engine.EnabledRules())
  }
}
