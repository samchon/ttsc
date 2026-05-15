package main

import "testing"

// TestFilterFindingsPartitionsByRuleCategory verifies the finding partitioner.
//
// `filterFormatFindings` and `filterLintFindings` are the load-bearing routers
// between the two subcommands. They must be exact complements: every finding
// belongs to exactly one bucket and the buckets share no entries. Testing
// them through a synthetic finding list keeps the partitioner correctness
// guarantee independent of any specific rule's behavior.
//
// 1. Build a mixed finding slice with format and lint entries plus a nil.
// 2. Run both filters.
// 3. Assert the bucket contents and that the union is the non-nil input.
func TestFilterFindingsPartitionsByRuleCategory(t *testing.T) {
  findings := []*Finding{
    {Rule: "no-var", IsFormat: false},
    {Rule: "format/semi", IsFormat: true},
    nil,
    {Rule: "format/quotes", IsFormat: true},
    {Rule: "eqeqeq", IsFormat: false},
  }
  formatBucket := filterFormatFindings(findings)
  lintBucket := filterLintFindings(findings)
  if len(formatBucket) != 2 {
    t.Fatalf("format bucket: want 2, got %d", len(formatBucket))
  }
  if len(lintBucket) != 2 {
    t.Fatalf("lint bucket: want 2, got %d", len(lintBucket))
  }
  for _, f := range formatBucket {
    if !f.IsFormat {
      t.Fatalf("format bucket leaked lint finding: %+v", f)
    }
  }
  for _, f := range lintBucket {
    if f.IsFormat {
      t.Fatalf("lint bucket leaked format finding: %+v", f)
    }
  }
  // Nil findings must be dropped, never panicked.
  for _, bucket := range [][]*Finding{formatBucket, lintBucket} {
    for _, f := range bucket {
      if f == nil {
        t.Fatalf("partitioner leaked nil finding")
      }
    }
  }
}
