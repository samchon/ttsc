package linthost

import (
  "encoding/json"
  "strings"
  "testing"
)

// TestConfigStoreValidatesEveryScopedOptionVariant proves engine construction
// cannot hide an invalid option behind a later valid tuple for a disjoint file
// selector. The old project-wide map validated only the last parsed payload.
func TestConfigStoreValidatesEveryScopedOptionVariant(t *testing.T) {
  store := &ConfigStore{entries: []ConfigEntry{
    {
      BaseDir: "/project",
      Files:   []string{"tests/**"},
      Rules:   RuleConfig{"no-restricted-syntax": SeverityError},
      Options: RuleOptionsMap{"no-restricted-syntax": json.RawMessage(`"VariableDeclaration["`)},
    },
    {
      BaseDir: "/project",
      Files:   []string{"src/**"},
      Rules:   RuleConfig{"no-restricted-syntax": SeverityError},
      Options: RuleOptionsMap{"no-restricted-syntax": json.RawMessage(`"VariableDeclaration"`)},
    },
  }}

  engine := NewEngineWithResolver(store)
  err := engine.ConfigError()
  if err == nil || !strings.Contains(err.Error(), `invalid options for rule "no-restricted-syntax"`) ||
    !strings.Contains(err.Error(), "invalid selector") {
    t.Fatalf("scoped invalid options were not rejected: %v", err)
  }
  if _, active := engine.EnabledRules()["no-restricted-syntax"]; active {
    t.Fatalf("rule with an invalid scoped variant entered dispatch: %v", engine.EnabledRules())
  }
}
