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
//     `files` to `src/**/*.ts` and declares a `format/*` option tuple.
//  2. Resolve rules for an in-scope path and for an out-of-scope path.
//  3. Assert the out-of-scope path receives no format-rule upgrade and the
//     in-scope path receives the standard warn-severity upgrade.
//
// @evidence contracts/testing.md#behavioral-verification ResolveRules upgrades the in-scope path to format/semi warn and marks the outside-files path OutOfScope with the rule off.
// @evidence contracts/testing.md#independent-expectations The authored files restriction and literal off/warn expectations establish admission independently of resolver matching output.
// @evidence contracts/testing.md#distinguishing-cases One ConfigStore entry restricted to src/**/*.ts is resolved for an in-scope path (format/semi upgraded to warn) and for a .json path outside the entry's files (must be OutOfScope with format/semi off), the symmetric twin of the ignores case; an entry with ignores instead of files is owned by the sibling test.
// @evidence contracts/testing.md#execution-ownership TestFormatCommandResolverSkipsUpgradeForFileOutsideEntryFiles owns its fixture cases as an in-process Go test discovered by the shared lint overlay runner. It calls the Go operations directly rather than launching a separately built product host.
func TestFormatCommandResolverSkipsUpgradeForFileOutsideEntryFiles(t *testing.T) {
  store := &ConfigStore{
    entries: []ConfigEntry{
      {
        BaseDir: "/project",
        Files:   []string{"src/**/*.ts"},
        Rules: RuleConfig{
          "no-var":      SeverityError,
          "format/semi": SeverityOff,
        },
        Options: RuleOptionsMap{
          "format/semi": json.RawMessage(`{"prefer":"always"}`),
        },
      },
    },
  }
  resolver := formatCommandResolver{inner: store}

  inScope := resolver.ResolveRules("/project/src/main.ts")
  if inScope.Rules.Severity("format/semi") != SeverityWarn {
    t.Fatalf("in-scope file: want formatSemi warn, got %v (resolved=%+v)",
      inScope.Rules.Severity("format/semi"), inScope.Rules)
  }

  outOfScope := resolver.ResolveRules("/project/extensions/theme-defaults/themes/dark_modern.json")
  if !outOfScope.OutOfScope {
    t.Fatalf("out-of-scope file was not marked inapplicable: %+v", outOfScope)
  }
  if outOfScope.Rules.Severity("format/semi") != SeverityOff {
    t.Fatalf("out-of-scope file: want formatSemi off, got %v (resolved=%+v)",
      outOfScope.Rules.Severity("format/semi"), outOfScope.Rules)
  }
}
