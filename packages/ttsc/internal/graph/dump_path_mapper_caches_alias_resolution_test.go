package graph

import "testing"

// TestDumpPathMapperCachesAliasResolution counts a test-owned mapper's
// canonicalizer callback for 100 repetitions of one supplied raw source path.
//
// A large graph maps one source through its node, IDs and many edge endpoints;
// caching only after EvalSymlinks would turn those facts into repeated syscalls.
//
//  1. Install a counting canonicalizer on one mapper.
//  2. Map the same absolute source path repeatedly.
//  3. Require one canonicalization and one stable wire coordinate.
//
// @evidence contracts/testing.md#behavioral-verification Mapping the same supplied absolute path 100 times must yield src/main.ts each time and call the test-owned canonicalize callback exactly once, without a latched mapper error. Actual graph fact traversal and native canonicalization counts are not observed.
// @evidence contracts/testing.md#independent-expectations The expectations are literal: mapping the same absolute path 100 times under project C:/checkout/app must always return src/main.ts and call the replaceable canonicalizer exactly once. The test exercises the mapper through its canonicalize seam, so it proves caching, not the real EvalSymlinks result.
// @evidence contracts/testing.md#distinguishing-cases Install a counting canonicalizer on one mapper; Map the same absolute source path repeatedly; Require one canonicalization and one stable wire coordinate.
// @evidence contracts/testing.md#execution-ownership This same-package Go unit constructs one mapper and supplies its instance-owned canonicalize callback before directly invoking mapPath. The constructor still attempts best-effort native project canonicalization for host-compatible C:/checkout/app; that work occurs before the counter. No foreign method is replaced, graph Program loaded or product process started.
func TestDumpPathMapperCachesAliasResolution(t *testing.T) {
  mapper := newDumpPathMapper("C:/checkout/app")
  calls := 0
  mapper.canonicalize = func(path string) string {
    calls++
    return path
  }
  for range 100 {
    if wire := mapper.mapPath("C:/checkout/app/src/main.ts"); wire != "src/main.ts" {
      t.Fatalf("wire path = %q, want src/main.ts", wire)
    }
  }
  if calls != 1 {
    t.Fatalf("canonicalizer calls = %d, want 1", calls)
  }
  if err := mapper.err(); err != nil {
    t.Fatalf("mapping the repeated source path failed: %v", err)
  }
}
