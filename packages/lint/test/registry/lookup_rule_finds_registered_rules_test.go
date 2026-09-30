package linthost

import "testing"

// TestLookupRuleFindsRegisteredRules verifies registry lookup behavior.
//
// LookupRule is the direct registry accessor used by tests and introspection
// code. It should return implemented rules without manufacturing placeholders
// for unknown names.
//
// This scenario covers both the hit and miss branches against the package-global
// registry populated by rule init functions.
//
// 1. Look up a known registered rule.
// 2. Look up a deliberately missing rule name.
// 3. Assert the known rule is returned and the unknown rule is absent.
//
// @evidence contracts/testing.md#behavioral-verification LookupRule returns the registered no-var implementation with its exact identity and returns nil for never-existed, without inventing a placeholder.
// @evidence contracts/testing.md#independent-expectations The registry accessor contract preserves registered identities and represents an absent registration as nil; independent literal hit and miss names supply expectations.
// @evidence contracts/testing.md#distinguishing-cases Owns one live core-rule hit and one adjacent unknown-name miss; AllRuleNames owns complete enumeration, while duplicate registration has a separate mutation test.
// @evidence contracts/testing.md#execution-ownership TestLookupRuleFindsRegisteredRules directly calls the public registry accessor in the selected Go unit batch, without checking repository arrangement, installing a package or running a product host.
func TestLookupRuleFindsRegisteredRules(t *testing.T) {
  rule := LookupRule("no-var")
  if rule == nil || rule.Name() != "no-var" {
    t.Fatalf("expected no-var lookup hit, got rule=%v", rule)
  }
  if rule := LookupRule("never-existed"); rule != nil {
    t.Fatalf("expected unknown lookup miss, got rule=%v", rule)
  }
}
