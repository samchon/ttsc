package linthost

import (
  "regexp"
  "sync"
)

// userPatternCache memoizes RE2 compilation of option-supplied regex patterns.
//
// Several rules accept a custom regex option — no-fallthrough's and
// default-case's `commentPattern`, functional's identifier patterns,
// no-param-reassign's `ignorePropertyModificationsForRegex` — and request their
// config-derived patterns during dispatch. Equal pattern strings reuse a
// published regexp or error across requests. Each miss compiles before
// LoadOrStore, so concurrent cold misses can compile more than once while
// returning the same winning result. The process-wide map retains every
// distinct requested pattern without eviction or a size bound.
//
// The engine walks files in parallel, so access is synchronized. Both the
// compiled regexp and a compile error are cached so every caller keeps its
// existing success/failure handling — an invalid custom pattern still surfaces
// its error, and subsequent cache hits avoid recompilation.
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
