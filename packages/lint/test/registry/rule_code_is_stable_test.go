package linthost

import (
  "testing"
)

// TestRuleCodeIsStable verifies that RuleCode returns the same numeric code across
// repeated calls for the same rule name, that codes fall in the reserved [9000, 18000)
// banner range, and that two distinct rule names do not hash-collide.
//
// Diagnostic codes are exposed in editor UIs and suppression directives; a code change
// across builds breaks saved suppressions and CI filters. RuleCode is based on FNV-1a
// 32-bit hashed into the banner band, so it is deterministic for a given name but must
// still be explicitly verified against the band boundaries. The two-name collision check
// uses names known not to share an FNV-1a code; if a future hash change introduces a
// collision this test fails before the change ships.
//
// 1. Call RuleCode("noVar") twice and assert both results are equal.
// 2. Assert the code falls within [9000, 18000).
// 3. Assert RuleCode("noVar") and RuleCode("noDebugger") differ.
func TestRuleCodeIsStable(t *testing.T) {
  // The hashed rule code must be deterministic across runs and inside
  // the (9000, 18000) banner range.
  code := RuleCode("noVar")
  again := RuleCode("noVar")
  if code != again {
    t.Errorf("ruleCode is non-deterministic")
  }
  if code < 9000 || code >= 18000 {
    t.Errorf("ruleCode out of expected band: %d", code)
  }
  // Two distinct rules should not share a code unless we're unlucky;
  // pick names known not to hash-collide with FNV-1a 32-bit.
  a := RuleCode("noVar")
  b := RuleCode("noDebugger")
  if a == b {
    t.Errorf("ruleCode collision for noVar vs noDebugger")
  }
}
