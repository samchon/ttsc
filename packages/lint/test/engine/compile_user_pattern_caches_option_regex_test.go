package linthost

import "testing"

// TestCompileUserPatternCachesOptionRegex verifies compileUserPattern compiles
// an option-supplied pattern once and reuses the result.
//
// Option-derived regexes (no-fallthrough / default-case commentPattern,
// functional identifier patterns, no-param-reassign ignore patterns) used to
// call regexp.Compile inside Check, rebuilding the same immutable automaton on
// every visited node. The cache collapses that to a single compile, so a repeat
// request for the same pattern must return the identical *regexp.Regexp pointer;
// a distinct pattern must compile independently; and an invalid pattern must
// keep returning its cached error rather than recompiling.
//
//  1. Compile a valid pattern twice and assert pointer identity (compiled once).
//  2. Compile a different pattern and assert it is a distinct instance.
//  3. Compile an invalid pattern twice and assert the error is stable and no
//     regexp is returned.
//
// @evidence contracts/testing.md#behavioral-verification compileUserPattern retains case-insensitive marker matching, rejects unrelated text, reuses the same compiled pointer, separates another pattern and retains invalid-pattern errors without returning a regexp.
// @evidence contracts/testing.md#independent-expectations The authored RE2 expression independently matches CUSTOM marker and excludes unrelated marker; equal-input pointer identity and unequal-pattern separation are the public memoization observations, not an internal cache-layout comparison.
// @evidence contracts/testing.md#distinguishing-cases Valid first/repeated lookup, distinct pattern and repeated malformed ([ input distinguish success, reuse and error retention; the unmatched text prevents an always-matching cached regexp from passing.
// @evidence contracts/testing.md#execution-ownership Direct compileUserPattern calls and MatchString predicates run in one Go test process with literal patterns; no source-file scan, consumer installation or native host build participates.
func TestCompileUserPatternCachesOptionRegex(t *testing.T) {
  const pattern = `(?i)custom\s?marker`
  first, err := compileUserPattern(pattern)
  if err != nil || first == nil {
    t.Fatalf("first compile: re=%v err=%v", first, err)
  }
  second, err := compileUserPattern(pattern)
  if err != nil {
    t.Fatalf("second compile error: %v", err)
  }
  if first != second {
    t.Fatalf("same pattern must reuse one compiled regexp: %p != %p", first, second)
  }
  if !first.MatchString("CUSTOM marker") {
    t.Fatalf("cached regexp lost its behavior")
  }

  if first.MatchString("unrelated marker") {
    t.Fatal("cached regexp matched unrelated source")
  }

  other, err := compileUserPattern(pattern + "-other")
  if err != nil || other == nil {
    t.Fatalf("distinct pattern compile: re=%v err=%v", other, err)
  }
  if other == first {
    t.Fatalf("distinct patterns must not share one compiled regexp")
  }

  const invalid = `([`
  re1, err1 := compileUserPattern(invalid)
  re2, err2 := compileUserPattern(invalid)
  if err1 == nil || err2 == nil {
    t.Fatalf("invalid pattern must report an error: %v / %v", err1, err2)
  }
  if re1 != nil || re2 != nil {
    t.Fatalf("invalid pattern must not yield a regexp: %v / %v", re1, re2)
  }
  if err1.Error() != err2.Error() {
    t.Fatalf("cached error must be stable: %q != %q", err1, err2)
  }
}
