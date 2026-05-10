package main

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
func TestLookupRuleFindsRegisteredRules(t *testing.T) {
	rule := LookupRule("no-var")
	if rule == nil || rule.Name() != "no-var" {
		t.Fatalf("expected no-var lookup hit, got rule=%v", rule)
	}
	if rule := LookupRule("never-existed"); rule != nil {
		t.Fatalf("expected unknown lookup miss, got rule=%v", rule)
	}
}
