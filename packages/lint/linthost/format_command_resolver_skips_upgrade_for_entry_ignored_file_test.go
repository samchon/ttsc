package linthost

import (
  "encoding/json"
  "testing"
)

// TestFormatCommandResolverSkipsUpgradeForEntryIgnoredFile verifies that the
// `ttsc format` resolver honors `ignores` on entries that also carry a `rules`
// block.
//
// The ordinary entry's ignore match excludes its contributions. With no other
// ordinary entry matching, ConfigStore returns OutOfScope rather than the
// global Ignored state. The format resolver preserves that result; a matched
// file instead receives the configured format severity upgrade. This direct
// case does not reproduce historical engine walks or source rewrites.
//
//  1. Build a `*ConfigStore` whose single entry has both `rules` and an
//     `ignores` list plus a `format/*` option tuple.
//  2. Resolve rules for an ignored path and for an unrelated path.
//  3. Assert the ignored path receives no format-rule upgrade and the
//     unrelated path receives the standard warn-severity upgrade.
//
// @evidence contracts/testing.md#behavioral-verification ResolveRules marks the entry-ignored path OutOfScope with format/semi off while upgrading a matched unrelated path to warn.
// @evidence contracts/testing.md#independent-expectations The authored ignore path and literal off/warn severities express entry applicability independently of ConfigStore flag computation.
// @evidence contracts/testing.md#distinguishing-cases One ConfigStore entry carrying both rules and an ignores glob is resolved for the ignored path (must be OutOfScope with format/semi still off) and for an unrelated path (format/semi upgraded off to warn). The pair separates entry applicability; it does not isolate the early OutOfScope guard from the later undeclared-rule promotion guard.
// @evidence contracts/testing.md#execution-ownership TestFormatCommandResolverSkipsUpgradeForEntryIgnoredFile owns its authored ConfigStore entries and direct resolver assertions in the public Go unit population. It starts no consumer install, native build or separately built product host.
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
