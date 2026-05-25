package linthost

import (
  "encoding/json"
  "testing"
)

// TestFormatCommandResolverSkipsUpgradeForFileOutsideEntryFiles verifies that
// the `ttsc format` resolver honors `files` on every non-IgnoreOnly entry —
// the symmetric guard to the existing `ignores` check.
//
// `ConfigStore.ResolveRules` only sets `ResolvedRuleConfig.Ignored = true`
// for `IgnoreOnly` entries. An entry that restricts `files` to e.g.
// `["src/**/*.ts"]` simply has its rule contributions skipped via
// `ConfigEntry.matchesFile` for files outside that scope, leaving
// `Ignored = false`. Without a symmetric guard the format resolver would
// upgrade every registered format rule to `warn` for files no entry actually
// targets — so `ttsc format` would rewrite e.g. a `.json` resolved into the
// program via `resolveJsonModule`, even when the only entry targets
// `src/**/*.ts`. This case pins the resolver-side guard that closes that
// gap.
//
//  1. Build a `*ConfigStore` whose single non-IgnoreOnly entry restricts
//     `files` to `src/**/*.ts`, and whose options map registers a `format/*`
//     rule.
//  2. Resolve rules for an in-scope path and for an out-of-scope path.
//  3. Assert the out-of-scope path receives no format-rule upgrade and the
//     in-scope path receives the standard warn-severity upgrade.
func TestFormatCommandResolverSkipsUpgradeForFileOutsideEntryFiles(t *testing.T) {
  store := &ConfigStore{
    entries: []ConfigEntry{
      {
        BaseDir: "/project",
        Files:   []string{"src/**/*.ts"},
        Rules: RuleConfig{
          "noVar": SeverityError,
        },
      },
    },
    options: RuleOptionsMap{
      "formatSemi": json.RawMessage(`{"prefer":"always"}`),
    },
  }
  resolver := formatCommandResolver{inner: store}

  inScope := resolver.ResolveRules("/project/src/main.ts")
  if inScope.Rules.Severity("formatSemi") != SeverityWarn {
    t.Fatalf("in-scope file: want formatSemi warn, got %v (resolved=%+v)",
      inScope.Rules.Severity("formatSemi"), inScope.Rules)
  }

  outOfScope := resolver.ResolveRules("/project/extensions/theme-defaults/themes/dark_modern.json")
  if outOfScope.Rules.Severity("formatSemi") != SeverityOff {
    t.Fatalf("out-of-scope file: want formatSemi off, got %v (resolved=%+v)",
      outOfScope.Rules.Severity("formatSemi"), outOfScope.Rules)
  }
}
