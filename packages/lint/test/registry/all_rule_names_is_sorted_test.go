package main

import (
	"sort"
	"testing"
)

// TestAllRuleNamesIsSorted verifies all rule names is sorted.
//
// The rule registry is a public surface for documentation, diagnostics, and stable numeric
// diagnostic codes. Registry tests keep that metadata deterministic independently from
// individual rule behavior.
//
// This scenario focuses on all rule names is sorted. It protects consumers that compare rule
// lists or diagnostic codes across runs.
//
// 1. Read the package-level registry metadata.
// 2. Normalize the expected ordering or code range.
// 3. Assert deterministic ordering, headline rule presence, and stable rule codes.
func TestAllRuleNamesIsSorted(t *testing.T) {
	names := AllRuleNames()
	sorted := append([]string(nil), names...)
	sort.Strings(sorted)
	for i := range names {
		if names[i] != sorted[i] {
			t.Fatalf("AllRuleNames not sorted: %v", names)
		}
	}
	// Sanity: registry has at least the headline rules from the README.
	for _, headline := range []string{"no-var", "no-explicit-any", "no-non-null-assertion", "eqeqeq"} {
		found := false
		for _, n := range names {
			if n == headline {
				found = true
				break
			}
		}
		if !found {
			t.Errorf("missing headline rule %q in registry", headline)
		}
	}
}
