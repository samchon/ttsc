package linthost

import (
  "testing"
)

// TestParseRulesNilTreatedAsEmpty verifies that a nil rules map is accepted and returns an
// empty RuleConfig rather than an error.
//
// Callers may pass no rules map to the direct ParseRules API. Nil must have
// the same empty-configuration meaning as an authored empty map, so callers
// need no separate nil guard. This case does not exercise plugin JSON loading.
//
// 1. Call ParseRules(nil).
// 2. Assert no error is returned.
// 3. Assert the returned RuleConfig has zero entries.
//
// @evidence contracts/testing.md#behavioral-verification ParseRules accepts nil as an empty rule configuration and does not invent a rule.
// @evidence contracts/testing.md#independent-expectations The absence-of-rules contract independently requires an empty result and no error, for both nil and an authored empty map.
// @evidence contracts/testing.md#distinguishing-cases Nil and a nonnil empty map are the empty-input boundary; neighboring numeric, string and tuple cases own populated configurations.
// @evidence contracts/testing.md#execution-ownership This discoverable Go entry owns the case described above. Nil and an authored empty map call ParseRules directly in-process; empty returned configurations are observed without fixture files, rule dispatch or a child host.
func TestParseRulesNilTreatedAsEmpty(t *testing.T) {
  cfg, err := ParseRules(nil)
  if err != nil {
    t.Fatalf("unexpected error: %v", err)
  }
  if len(cfg) != 0 {
    t.Errorf("want empty config, got %v", cfg)
  }

  empty, err := ParseRules(map[string]any{})
  if err != nil || len(empty) != 0 {
    t.Errorf("empty map must remain empty: config=%v err=%v", empty, err)
  }
}
