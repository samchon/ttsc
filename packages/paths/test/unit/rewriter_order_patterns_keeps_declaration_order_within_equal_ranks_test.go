package paths_test

import (
  "reflect"
  "testing"
)

// TestRewriterOrderPatternsKeepsDeclarationOrderWithinEqualRanks verifies the whole precedence order of a large pattern table.
//
// Go's unstable sort falls back to insertion sort below a dozen elements, which
// keeps equal elements in order by accident, so a two-pattern table cannot tell
// a stable sort from an unstable one. A real tsconfig can declare far more
// aliases than that. This table interleaves twenty patterns of four ranks so a
// sort that reorders equal-rank entries is observable.
//
// 1. Declare five exact patterns and fifteen wildcard patterns of three literal prefix lengths, interleaved.
// 2. Order the table.
// 3. Assert exact patterns first, then longer literal prefixes first, each rank in declaration order.
//
// @evidence contracts/testing.md#behavioral-verification Calls pathsOrderPatterns on a twenty-entry interleaved table and compares the complete resulting pattern sequence, so a misplaced exact pattern, a wrong prefix ranking or any reordering inside an equal rank changes the sequence.
// @evidence contracts/testing.md#independent-expectations tsc's matchPatternOrExact tries exact keys before wildcards and findBestPatternMatch replaces its current best only for a strictly longer literal prefix, so equal prefixes keep declaration order. The expected sequence is written as four literal groups, not produced by the ordering helper.
// @evidence contracts/testing.md#distinguishing-cases Owns exact-versus-wildcard placement, three prefix lengths and equal-rank stability over more than a dozen entries; the two-pattern tie in both declaration orders and the resolution-level precedence are owned by sibling cases.
// @evidence contracts/testing.md#execution-ownership Unit entry in test/unit that runs pathsOrderPatterns on a literal slice in the Go process; no filesystem, Program or compiler host is involved.
func TestRewriterOrderPatternsKeepsDeclarationOrderWithinEqualRanks(t *testing.T) {
  declared := []string{
    "@a/*s0", "@e0", "@a/b/*s1", "@a/b/c/*s2",
    "@a/*s3", "@e1", "@a/b/*s4", "@a/b/c/*s5",
    "@a/*s6", "@e2", "@a/b/*s7", "@a/b/c/*s8",
    "@a/*s9", "@e3", "@a/b/*s10", "@a/b/c/*s11",
    "@a/*s12", "@e4", "@a/b/*s13", "@a/b/c/*s14",
  }
  patterns := make([]pathsPathPattern, len(declared))
  for i, pattern := range declared {
    patterns[i] = pathsPathPattern{pattern: pattern, targets: []string{"src/*"}}
  }
  pathsOrderPatterns(patterns)
  got := make([]string, len(patterns))
  for i, pattern := range patterns {
    got[i] = pattern.pattern
  }
  want := []string{
    "@e0", "@e1", "@e2", "@e3", "@e4",
    "@a/b/c/*s2", "@a/b/c/*s5", "@a/b/c/*s8", "@a/b/c/*s11", "@a/b/c/*s14",
    "@a/b/*s1", "@a/b/*s4", "@a/b/*s7", "@a/b/*s10", "@a/b/*s13",
    "@a/*s0", "@a/*s3", "@a/*s6", "@a/*s9", "@a/*s12",
  }
  if !reflect.DeepEqual(got, want) {
    t.Fatalf("pattern order: got %q, want %q", got, want)
  }
}
