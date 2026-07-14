package linthost

import (
  "encoding/json"
  "testing"
)

// TestFormatCommandResolverKeepsConfiguredOptionsInsideMatchingEntry proves a
// scoped format tuple cannot be promoted into a file merely because that file
// matches some other config entry. The synthetic default set remains global,
// but a user-authored format block follows normal files/ignores scoping.
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

// TestFormatCommandResolverVariantsReplaceBareOptionsWithReachableDefaults
// keeps eager validation aligned with runtime binding. A nil inner payload is
// not reachable when the format command supplies a synthetic default.
func TestFormatCommandResolverVariantsReplaceBareOptionsWithReachableDefaults(t *testing.T) {
  resolver := formatCommandResolver{
    inner: RuleConfig{"format/semi": SeverityOff},
    defaultOptions: RuleOptionsMap{
      "format/semi": json.RawMessage(`{"prefer":"always"}`),
    },
  }
  variants := resolver.RuleOptionsVariants("format/semi")
  if len(variants) != 1 || string(variants[0]) != `{"prefer":"always"}` {
    t.Fatalf("validation variants do not match reachable defaults: %q", variants)
  }
}
