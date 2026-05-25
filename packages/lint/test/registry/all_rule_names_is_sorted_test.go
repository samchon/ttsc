package linthost

import (
  "sort"
  "testing"
)

// TestAllRuleNamesIsSorted verifies that AllRuleNames returns rule names in lexicographic
// order and that the set contains the headline rules advertised in the README.
//
// The rule list is consumed by documentation generators, diagnostic formatters, and
// anywhere the registry is iterated. An unsorted list produces non-deterministic output
// that changes each time a rule is added. Sorting at registration time, rather than at
// call time, is a performance choice that must be validated here. The headline check
// confirms that registration wiring is not accidentally excluded from a build tag.
//
// 1. Call AllRuleNames() and build a sorted copy of the result.
// 2. Compare element by element; fail on the first mismatch.
// 3. Verify that noVar, noExplicitAny, noNonNullAssertion, and eqeqeq are present.
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
  for _, headline := range []string{"noVar", "noExplicitAny", "noNonNullAssertion", "eqeqeq"} {
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
