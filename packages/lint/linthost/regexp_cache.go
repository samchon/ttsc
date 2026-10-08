package linthost

import (
  "regexp"
  "sync"
)

// userPatternCache belongs to a parsed configuration, or to an engine when
// its resolver supplies no configuration-owned cache. It retains successful
// and failed RE2 compilations only while that owner remains reachable.
// Separate live engines using the same parsed configuration share its cache;
// replacing a resident configuration does not retain its historical patterns.
type userPatternCache struct {
  results sync.Map // map[string]*userPatternResult
}

type userPatternResult struct {
  once sync.Once
  re   *regexp.Regexp
  err  error
}

// patternCacheForResolver borrows a built-in resolver's configuration cache.
// Other resolvers have no stable shared ownership identity, so their engine
// receives its own cache and requires stable configuration during execution.
func patternCacheForResolver(resolver RuleResolver) *userPatternCache {
  if owner, ok := resolver.(interface{ userPatterns() *userPatternCache }); ok {
    if cache := owner.userPatterns(); cache != nil {
      return cache
    }
  }
  return &userPatternCache{}
}

func (s *ConfigStore) userPatterns() *userPatternCache {
  if s == nil {
    return nil
  }
  return s.patterns
}

func (r boundProjectRuleResolver) userPatterns() *userPatternCache {
  return r.patterns
}

func (r formatCommandResolver) userPatterns() *userPatternCache {
  return patternCacheForResolver(r.inner)
}

// compileUserPattern preserves regexp.Compile results while sharing one
// compilation, including a failure, per pattern and owner. Parallel file
// workers publish the entry before compiling and synchronize through Once.
// A directly constructed Context owns its own cache; nil contexts compile
// without retaining a result. Contexts themselves are file-local and serial.
func (c *Context) compileUserPattern(pattern string) (*regexp.Regexp, error) {
  if c == nil {
    return regexp.Compile(pattern)
  }
  if c.patterns == nil {
    c.patterns = &userPatternCache{}
  }
  if cached, ok := c.patterns.results.Load(pattern); ok {
    return cached.(*userPatternResult).compile(pattern)
  }
  actual, _ := c.patterns.results.LoadOrStore(pattern, &userPatternResult{})
  return actual.(*userPatternResult).compile(pattern)
}

func (r *userPatternResult) compile(pattern string) (*regexp.Regexp, error) {
  r.once.Do(func() {
    r.re, r.err = regexp.Compile(pattern)
  })
  return r.re, r.err
}
