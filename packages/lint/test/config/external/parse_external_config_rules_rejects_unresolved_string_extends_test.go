package linthost

import (
  "strings"
  "testing"
)

// TestParseExternalConfigRulesRejectsUnresolvedStringExtends verifies that a string in the
// `extends` array (e.g. "eslint:recommended") is rejected with an instructive error.
//
// String extends are unresolved module references that require ESLint's resolver. The native
// parser can only inline pre-resolved objects and arrays; accepting a string would silently
// ignore entire rule sets. The error message must name the allowed shapes so users know whether
// to resolve the string first or switch to parseExternalConfigStoreForFile for the runtime path.
//
// 1. Build a config object with `extends: ["eslint:recommended"]`.
// 2. Parse through parseExternalConfigRules.
// 3. Assert an error containing the supported element shapes.
func TestParseExternalConfigRulesRejectsUnresolvedStringExtends(t *testing.T) {
  _, err := parseExternalConfigRules(map[string]any{
    "extends": []any{"eslint:recommended"},
  })
  if err == nil {
    t.Fatal("expected string extends to be rejected")
  }
  if !strings.Contains(err.Error(), "config.extends[0] must be an object or flat config array") {
    t.Fatalf("error should explain unsupported unresolved extends, got %v", err)
  }
}
