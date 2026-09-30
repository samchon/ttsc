package linthost

import (
  "encoding/json"
  "testing"
)

// TestFormatCommandResolverSkipsUpgradeForEntryIgnoredFile verifies that the
// `ttsc format` resolver honors `ignores` on entries that also carry a `rules`
// block.
//
// `ConfigStore.ResolveRules` only sets `ResolvedRuleConfig.Ignored = true` for
// `IgnoreOnly` entries — the ones with no `files` and no `rules`. An entry
// that carries both `rules` and `ignores` simply has its rule contributions
// skipped via `ConfigEntry.matchesFile`, leaving `Ignored = false`. Before
// this fix the format resolver only inspected the `Ignored` flag, so it
// re-upgraded every registered format rule to `warn` for files the user had
// explicitly listed in an entry's `ignores`. The engine's lint walk skipped
// those files but `ttsc format` rewrote them anyway. This case pins the
// resolver-side guard that closes that gap.
//
//  1. Build a `*ConfigStore` whose single entry has both `rules` and an
//     `ignores` list plus a `format/*` option tuple.
//  2. Resolve rules for an ignored path and for an unrelated path.
//  3. Assert the ignored path receives no format-rule upgrade and the
//     unrelated path receives the standard warn-severity upgrade.
// @evidence contracts/testing.md#behavioral-verification ResolveRules marks the entry-ignored path OutOfScope with format/semi off while upgrading a matched unrelated path to warn.
// @evidence contracts/testing.md#independent-expectations The authored ignore path and literal off/warn severities express entry applicability independently of ConfigStore flag computation.
// @evidence contracts/testing.md#distinguishing-cases The authored scenario begins with: Build a `*ConfigStore` whose single entry has both `rules` and an `ignores` list plus a `format/*` option tuple. The asserted decision is: Assert the ignored path receives no format-rule upgrade and the unrelated path receives the standard warn-severity upgrade. Other fixture shapes remain in their separately named hosts.
// @evidence contracts/testing.md#execution-ownership TestFormatCommandResolverSkipsUpgradeForEntryIgnoredFile owns its fixture cases as an in-process Go test discovered by the shared lint overlay runner. It calls the Go operations directly rather than launching a separately built product host.
func TestFormatCommandResolverSkipsUpgradeForEntryIgnoredFile(t *testing.T) {
  store := &ConfigStore{
    entries: []ConfigEntry{
      {
        BaseDir: "/project",
        Ignores: []string{"src/driver/mongodb/typings.ts"},
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

  ignored := resolver.ResolveRules("/project/src/driver/mongodb/typings.ts")
  if !ignored.OutOfScope {
    t.Fatalf("entry-ignored file was not marked inapplicable: %+v", ignored)
  }
  if ignored.Rules.Severity("format/semi") != SeverityOff {
    t.Fatalf("ignored file: want formatSemi off, got %v (resolved=%+v)",
      ignored.Rules.Severity("format/semi"), ignored.Rules)
  }

  other := resolver.ResolveRules("/project/src/main.ts")
  if other.Rules.Severity("format/semi") != SeverityWarn {
    t.Fatalf("non-ignored file: want formatSemi warn, got %v (resolved=%+v)",
      other.Rules.Severity("format/semi"), other.Rules)
  }
}
