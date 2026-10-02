package linthost

import (
  "encoding/json"
  "strings"
  "testing"
)

// TestConfigStoreValidatesEveryScopedOptionVariant verifies engine construction
// cannot hide an invalid option behind a later valid tuple for a disjoint file
// selector. A single project-wide map would validate only the last parsed payload.
//
// 1. Place an invalid test selector before a valid source selector.
// 2. Construct the engine without visiting a source file.
// 3. Require the invalid-selector diagnostic and exclusion from enabled dispatch.
// 4. Construct the valid-only scope and require acceptance and enabled dispatch.
//
// @evidence contracts/testing.md#behavioral-verification NewEngineWithResolver reports invalid-selector options from the earlier tests scope even when the later src scope has a valid selector and excludes the rule from dispatch; the valid-only scope has no ConfigError and remains enabled.
// @evidence contracts/testing.md#independent-expectations Every declared variant must validate before execution; independently authored unterminated VariableDeclaration[ and valid VariableDeclaration distinguish whole-population validation from last-value masking.
// @evidence contracts/testing.md#distinguishing-cases Invalid-first/valid-last disjoint scopes and fail-closed dispatch contrast a valid-only accepted engine, ruling out both last-value masking and unconditional rejection without visiting a source.
// @evidence contracts/testing.md#execution-ownership This discoverable Go entry owns the case described above. NewEngineWithResolver binds two authored scoped selector payloads in the shared Go process; ConfigError and EnabledRules observe validation before any source walk, without compiling a native contributor.
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

  valid := NewEngineWithResolver(&ConfigStore{entries: store.entries[1:]})
  if err := valid.ConfigError(); err != nil {
    t.Fatalf("valid-only scoped selector was rejected: %v", err)
  }
  if valid.EnabledRules()["no-restricted-syntax"] != SeverityError {
    t.Fatalf("valid-only scoped selector did not enter dispatch: %v", valid.EnabledRules())
  }
}
