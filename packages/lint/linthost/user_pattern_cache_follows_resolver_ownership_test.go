package linthost

import (
  "runtime"
  "testing"
  "weak"
)

// TestUserPatternCacheFollowsResolverOwnership verifies parsed configuration
// ownership survives engine and command-wrapper changes, then becomes collectible.
//
// An independently retained regexp remains usable after its cache owner ends.
// Custom resolvers and manually built contexts have explicit local owners.
//
//  1. Compile through engines, a value copy and bound/format wrappers of one parsed store.
//  2. Assert shared valid/invalid results and distinct standalone engine owners.
//  3. Release all owners, force GC, and retain the returned regexp's behavior.
//
// @evidence contracts/testing.md#behavioral-verification NewEngineWithResolver, a read-only ConfigStore copy and the bound/format adapters reuse one parsed store's regexp/error identities; independent custom-resolver engines have separate caches, nil contexts preserve compile semantics, and weak references observe cache retirement while the returned regexp still matches.
// @evidence contracts/testing.md#independent-expectations One immutable parsed configuration establishes the shareable input; explicit release makes its cache unreachable under Go weak-pointer semantics, while RE2 ^live$ independently defines the matching oracle.
// @evidence contracts/testing.md#distinguishing-cases Direct, copied, bound and formatting consumers cover shared ownership, including copying a store after first cache use; custom engines, a typed-nil store, direct/nil contexts, valid/invalid patterns and post-owner use distinguish fallbacks and safe retirement. Resident reload and failure transitions belong to the resident case.
// @evidence contracts/testing.md#execution-ownership Resolver parsing, engine construction, compilation and GC execute directly in one Go test process; no native host or installed consumer is required.
func TestUserPatternCacheFollowsResolverOwnership(t *testing.T) {
  retired, re := func() (weak.Pointer[userPatternCache], interface{ MatchString(string) bool }) {
    store, err := parseExternalConfigStore(map[string]any{
      "rules": map[string]any{"default-case": "error"},
    }, "")
    if err != nil {
      t.Fatal(err)
    }
    bound, err := bindProjectRuleResolver(store)
    if err != nil {
      t.Fatal(err)
    }
    engines := []*Engine{
      NewEngineWithResolver(store),
      NewEngineWithResolver(store),
      NewEngineWithResolver(bound),
      NewEngineWithResolver(formatCommandResolver{inner: bound}),
    }
    ctx := &Context{patterns: engines[0].patterns}
    first, err := ctx.compileUserPattern(`^live$`)
    if err != nil {
      t.Fatal(err)
    }
    _, failure := ctx.compileUserPattern(`([`)
    if failure == nil {
      t.Fatal("malformed pattern did not fail")
    }
    copied := *store
    engines = append(engines, NewEngineWithResolver(&copied))
    for _, engine := range engines {
      current := &Context{patterns: engine.patterns}
      actual, err := current.compileUserPattern(`^live$`)
      _, invalid := current.compileUserPattern(`([`)
      if actual != first || err != nil || invalid != failure {
        t.Fatal("parsed configuration consumers did not share results")
      }
    }
    custom := InlineRuleResolver{Rules: RuleConfig{"default-case": SeverityError}}
    a, b := NewEngineWithResolver(custom), NewEngineWithResolver(custom)
    if a.patterns == b.patterns || a.patterns == engines[0].patterns {
      t.Fatal("standalone engines did not own independent caches")
    }
    var missing *ConfigStore
    empty := NewEngineWithResolver(missing)
    if empty.ConfigError() != nil || empty.patterns == nil || len(empty.Run(nil, nil)) != 0 {
      t.Fatal("typed-nil store no longer represents an empty configuration")
    }
    var absent *Context
    nilResult, err := absent.compileUserPattern(`^live$`)
    if err != nil || !nilResult.MatchString("live") {
      t.Fatal("nil context changed compile semantics")
    }
    if result, err := absent.compileUserPattern(`([`); result != nil || err == nil {
      t.Fatal("nil context lost a compile error")
    }
    return weak.Make(engines[0].patterns), first
  }()
  runtime.GC()
  if retired.Value() != nil {
    t.Fatal("released configuration retained its cache")
  }
  if !re.MatchString("live") || re.MatchString("lives") {
    t.Fatal("cache retirement invalidated an independently retained regexp")
  }
}
