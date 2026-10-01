package linthost

import (
  "regexp"
  "sync"
)

// userPatternCache memoizes RE2 compilation of option-supplied regex patterns.
//
// Several rules accept a custom regex option — no-fallthrough's and
// default-case's `commentPattern`, functional's identifier patterns,
// no-param-reassign's `ignorePropertyModificationsForRegex` — and compile it
// inside Check. That recompiles the same immutable, config-derived automaton on
// every invocation: once per visited node, or once per candidate name in an
// inner loop. The pattern is invariant for a whole run, so compiling it once and
// reusing the result collapses the per-node cost to a single compile. Distinct
// option patterns come from configuration and are therefore few and bounded, so
// the cache cannot grow without bound.
//
// The engine walks files in parallel, so access is synchronized. Both the
// compiled regexp and a compile error are cached so every caller keeps its
// existing success/failure handling — an invalid custom pattern still surfaces
// its error, just without recompiling on each visit.
var userPatternCache sync.Map // map[string]userPatternResult

type userPatternResult struct {
  re  *regexp.Regexp
  err error
}

// compileUserPattern compiles an option-supplied RE2 pattern, memoizing the
// (regexp, error) result keyed by the pattern text. It is a drop-in replacement
// for regexp.Compile at option-derived call sites that run during dispatch, with
// identical return semantics.
func compileUserPattern(pattern string) (*regexp.Regexp, error) {
  if cached, ok := userPatternCache.Load(pattern); ok {
    result := cached.(userPatternResult)
    return result.re, result.err
  }
  re, err := regexp.Compile(pattern)
  actual, _ := userPatternCache.LoadOrStore(pattern, userPatternResult{re: re, err: err})
  result := actual.(userPatternResult)
  return result.re, result.err
}
