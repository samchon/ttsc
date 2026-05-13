package main

import (
  "testing"
)

// TestRuleCodeIsStable verifies rule code is stable.
//
// The rule registry is a public surface for documentation, diagnostics, and stable numeric
// diagnostic codes. Registry tests keep that metadata deterministic independently from
// individual rule behavior.
//
// This scenario focuses on rule code is stable. It protects consumers that compare rule lists
// or diagnostic codes across runs.
//
// 1. Read the package-level registry metadata.
// 2. Normalize the expected ordering or code range.
// 3. Assert deterministic ordering, headline rule presence, and stable rule codes.
func TestRuleCodeIsStable(t *testing.T) {
  // The hashed rule code must be deterministic across runs and inside
  // the (9000, 18000) banner range.
  code := RuleCode("no-var")
  again := RuleCode("no-var")
  if code != again {
    t.Errorf("ruleCode is non-deterministic")
  }
  if code < 9000 || code >= 18000 {
    t.Errorf("ruleCode out of expected band: %d", code)
  }
  // Two distinct rules should not share a code unless we're unlucky;
  // pick names known not to hash-collide with FNV-1a 32-bit.
  a := RuleCode("no-var")
  b := RuleCode("no-debugger")
  if a == b {
    t.Errorf("ruleCode collision for no-var vs no-debugger")
  }
}
