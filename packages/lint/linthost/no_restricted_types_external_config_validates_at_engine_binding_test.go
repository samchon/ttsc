package linthost

import (
  "strings"
  "testing"
)

// TestNoRestrictedTypesExternalConfigIsValidatedWhenTheEngineBindsIt verifies external restriction options are validated at engine binding.
//
// Parsing a generic severity tuple is not sufficient; the owning rule validator must still run when the external store binds to the engine.
//
// 1. Parse an external error-severity tuple containing a Boolean fixWith value.
// 2. Require generic external parsing to succeed, then bind that store to the engine.
// 3. Require a fixWith type error and exclusion from active dispatch.
//
// @evidence contracts/testing.md#behavioral-verification parseExternalConfigStore accepts generic tuple transport, but NewEngineWithResolver rejects its Boolean fixWith payload and excludes the rule from active dispatch.
// @evidence contracts/testing.md#independent-expectations The public fixWith option is a string; the authored external tuple with true and literal fixWith type diagnostic independently determine rejection after transport.
// @evidence contracts/testing.md#distinguishing-cases Owns the external-store route where generic parsing succeeds and owning schema validation fails, complementing direct-inline valid and invalid schema matrices.
// @evidence contracts/testing.md#execution-ownership This discoverable Go entry calls parseExternalConfigStore and NewEngineWithResolver directly on one authored severity tuple in the shared lint process, observing transport success followed by binding failure without a config-file script host or consumer installation.
func TestNoRestrictedTypesExternalConfigIsValidatedWhenTheEngineBindsIt(t *testing.T) {
  store, err := parseExternalConfigStore(map[string]any{
    "rules": map[string]any{
      noRestrictedTypesRuleName: []any{
        "error",
        map[string]any{"types": map[string]any{"Banned": map[string]any{"fixWith": true}}},
      },
    },
  }, "")
  if err != nil {
    t.Fatalf("parseExternalConfigStore: %v", err)
  }
  engine := NewEngineWithResolver(store)
  if err := engine.ConfigError(); err == nil || !strings.Contains(err.Error(), "fixWith must be a string") {
    t.Fatalf("engine ConfigError = %v", err)
  }
  if _, active := engine.EnabledRules()[noRestrictedTypesRuleName]; active {
    t.Fatalf("invalid external options entered the dispatch table: %v", engine.EnabledRules())
  }
}
