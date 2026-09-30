package linthost

import (
  "encoding/json"
  "testing"
)

// TestFormatCommandResolverKeepsConfiguredOptionsInsideMatchingEntry proves a
// scoped format tuple cannot be promoted into a file merely because that file
// matches some other config entry. The synthetic default set remains global,
// but a user-authored format block follows normal files/ignores scoping.
//
// @evidence contracts/testing.md#behavioral-verification formatCommandResolver.ResolveRules must promote only reachable format severities and preserve matching tuples without leaking tests-only options into src.
// @evidence contracts/testing.md#independent-expectations Explicit ConfigStore entries and literal warn/off and JSON tuple expectations follow entry files scoping, independently of the resolver fold.
// @evidence contracts/testing.md#distinguishing-cases The same entries are resolved for nonmatching src and matching tests paths, distinguishing severity-only global promotion from scoped tuple promotion.
// @evidence contracts/testing.md#execution-ownership TestFormatCommandResolverKeepsConfiguredOptionsInsideMatchingEntry is a public format unit selected by TestSelectedLintUnits. It calls the resolver directly on authored entries in the shared Go process, without consumer installation, building a native product artifact or starting a product host.
func TestFormatCommandResolverKeepsConfiguredOptionsInsideMatchingEntry(t *testing.T) {
  store := &ConfigStore{entries: []ConfigEntry{
    {
      BaseDir: "/project",
      Rules: RuleConfig{
        "no-var":      SeverityError,
        "format/semi": SeverityOff,
      },
    },
    {
      BaseDir: "/project",
      Files:   []string{"tests/**"},
      Rules: RuleConfig{
        "format/semi":   SeverityOff,
        "format/quotes": SeverityOff,
      },
      Options: RuleOptionsMap{
        "format/semi":   json.RawMessage(`{"prefer":"never"}`),
        "format/quotes": json.RawMessage(`{"prefer":"single"}`),
      },
    },
  }}
  resolver := formatCommandResolver{inner: store}

  source := resolver.ResolveRules("/project/src/main.ts")
  if source.Rules.Severity("format/semi") != SeverityWarn ||
    len(source.RuleOptions("format/semi")) != 0 {
    t.Fatalf("severity-only format setting borrowed scoped options: %+v options=%s",
      source.Rules, source.RuleOptions("format/semi"))
  }
  if source.Rules.Severity("format/quotes") != SeverityOff ||
    len(source.RuleOptions("format/quotes")) != 0 {
    t.Fatalf("entire scoped format setting leaked into source file: %+v options=%s",
      source.Rules, source.RuleOptions("format/quotes"))
  }

  testFile := resolver.ResolveRules("/project/tests/unit.ts")
  if testFile.Rules.Severity("format/semi") != SeverityWarn ||
    string(testFile.RuleOptions("format/semi")) != `{"prefer":"never"}` {
    t.Fatalf("matching format tuple was not promoted intact: %+v options=%s",
      testFile.Rules, testFile.RuleOptions("format/semi"))
  }
  if testFile.Rules.Severity("format/quotes") != SeverityWarn ||
    string(testFile.RuleOptions("format/quotes")) != `{"prefer":"single"}` {
    t.Fatalf("matching scoped format rule was not promoted intact: %+v options=%s",
      testFile.Rules, testFile.RuleOptions("format/quotes"))
  }
}
