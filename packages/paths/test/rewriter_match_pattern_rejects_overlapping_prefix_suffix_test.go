package paths_test

import "testing"

// TestRewriterMatchPatternRejectsOverlappingPrefixSuffix verifies wildcard matching never slices out of bounds.
//
// Locks the length guard in `paths.go::matchPattern`. A specifier can satisfy
// both the HasPrefix and HasSuffix probes while being shorter than the
// pattern's literal halves combined ("@lib/x" against "@lib/x*x"): the star
// capture `specifier[len(prefix):len(specifier)-len(suffix)]` then panics with
// inverted slice bounds and takes the whole sidecar down. tsc's isPatternMatch
// requires candidate.length >= prefix.length + suffix.length, so these
// specifiers must simply not match.
//
// 1. Match specifiers whose prefix and suffix probes overlap.
// 2. Assert no match (and no panic) for each.
// 3. Assert the boundary case with zero overlap still matches with an empty star.
func TestRewriterMatchPatternRejectsOverlappingPrefixSuffix(t *testing.T) {
  for _, specifier := range []string{"@lib/x", "@lib/"} {
    if star, ok := pathsMatchPattern("@lib/x*x", specifier); ok {
      t.Fatalf("overlapping specifier %q unexpectedly matched with star %q", specifier, star)
    }
  }
  if star, ok := pathsMatchPattern("@lib/x*x", "@lib/xx"); !ok || star != "" {
    t.Fatalf("zero-overlap boundary mismatch: star=%q ok=%v", star, ok)
  }
  if star, ok := pathsMatchPattern("@lib/x*x", "@lib/xyx"); !ok || star != "y" {
    t.Fatalf("regular match mismatch: star=%q ok=%v", star, ok)
  }
  if star, ok := pathsMatchPattern("@lib/*sub/*", "@lib/sub/thing"); ok {
    t.Fatalf("two-wildcard pattern unexpectedly matched with star %q", star)
  }
}
