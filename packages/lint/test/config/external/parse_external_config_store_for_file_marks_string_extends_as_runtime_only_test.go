package linthost

import (
  "testing"
)

// TestParseExternalConfigStoreForFileMarksStringExtendsAsRuntimeOnly verifies that a string in
// `extends` causes the resulting ConfigStore to require ESLint runtime execution.
//
// The native engine cannot resolve string module references (e.g. "eslint/recommended") without
// Node, so the store must be marked both WantsESLintRuntime and RequiresESLintRuntime. However,
// the local rules should still be stored so the command can produce partial native diagnostics
// while delegating extends resolution to the runtime.
//
// 1. Build a config object with a string extends entry and a local rule.
// 2. Parse through parseExternalConfigStoreForFile.
// 3. Assert both runtime flags are set and the local rule is accessible.
func TestParseExternalConfigStoreForFileMarksStringExtendsAsRuntimeOnly(t *testing.T) {
  store, err := parseExternalConfigStoreForFile(map[string]any{
    "extends": []any{"eslint/recommended"},
    "rules": map[string]any{
      "no-var": "error",
    },
  }, "/project")
  if err != nil {
    t.Fatalf("unexpected error: %v", err)
  }
  if !store.WantsESLintRuntime() {
    t.Fatal("string extends should request ESLint runtime")
  }
  if !store.RequiresESLintRuntime() {
    t.Fatal("string extends should require ESLint runtime")
  }
  if store.Flatten().Severity("no-var") != SeverityError {
    t.Fatalf("local rules should still be available for fallback diagnostics, got %+v", store.Flatten())
  }
}
