package linthost

import (
  "sort"
  "testing"
)

// TestAllRuleNamesIsSorted verifies that AllRuleNames returns rule names in lexicographic
// order, owns its returned slice, and includes representative active rule families.
//
// The rule list is consumed by documentation generators, diagnostic formatters, and
// anywhere the registry is iterated. An unsorted list produces non-deterministic output
// that changes each time a rule is added. Callers may mutate their returned slice
// without changing future enumeration. Representative live registrations verify
// the returned population rather than checking names in documentation.
//
// 1. Call AllRuleNames() and build a sorted copy of the result.
// 2. Compare element by element; fail on the first mismatch.
// 3. Verify that no-var, typescript/no-explicit-any, typescript/no-non-null-assertion, and eqeqeq are present.
// 4. Reject duplicate entries and mutate the result before verifying a fresh enumeration.
//
// @evidence contracts/testing.md#behavioral-verification AllRuleNames returns sorted, unique active registry names containing core and typed representative rules; mutating a returned slice leaves the next complete enumeration unchanged.
// @evidence contracts/testing.md#independent-expectations Lexicographic identity ordering and caller-owned storage are the accessor contract; an independently sorted copy checks ordering, authored rule names check active registration, and the saved copy checks isolation after mutation.
// @evidence contracts/testing.md#distinguishing-cases Owns complete population ordering, duplicate rejection, active family representatives and caller mutation versus fresh enumeration; LookupRule separately owns hit and miss behavior.
// @evidence contracts/testing.md#execution-ownership TestAllRuleNamesIsSorted invokes the actual registry accessor in the shared Go unit process. It reads no README, manifest or source text and launches no native producer or host.
func TestAllRuleNamesIsSorted(t *testing.T) {
  names := AllRuleNames()
  sorted := append([]string(nil), names...)
  sort.Strings(sorted)
  for i := range names {
    if names[i] != sorted[i] {
      t.Fatalf("AllRuleNames not sorted: %v", names)
    }
  }
  // Representative core and typed rules must be active in the registry.
  for _, headline := range []string{"no-var", "typescript/no-explicit-any", "typescript/no-non-null-assertion", "eqeqeq"} {
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
  for i := 1; i < len(names); i++ {
    if names[i] == names[i-1] {
      t.Fatalf("duplicate registered identity %q", names[i])
    }
  }
  if len(names) == 0 {
    t.Fatal("registered population must not be empty")
  }
  names[0] = "caller-owned-slice-mutation"
  again := AllRuleNames()
  if len(again) != len(sorted) {
    t.Fatalf("fresh enumeration length=%d, want %d", len(again), len(sorted))
  }
  for i := range sorted {
    if again[i] != sorted[i] {
      t.Fatalf("caller mutation changed registry enumeration at %d: %q != %q", i, again[i], sorted[i])
    }
  }
}
