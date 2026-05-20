package linthost

import (
  "testing"
)

// TestParseExternalConfigStoreForFileRequiresRuntimeFields verifies that ESLint-specific
// structural fields like `languageOptions.parser` and `plugins` trigger the runtime-required flag.
//
// These fields reference live JavaScript objects that cannot be serialized or interpreted by the
// native engine. When they appear in the config, the store must be marked as requiring ESLint
// runtime execution so the command path delegates to the installed ESLint instead of running the
// native engine alone.
//
// 1. Build a config object with languageOptions.parser and a plugins map.
// 2. Parse through parseExternalConfigStoreForFile.
// 3. Assert both WantsESLintRuntime and RequiresESLintRuntime are true.
func TestParseExternalConfigStoreForFileRequiresRuntimeFields(t *testing.T) {
  store, err := parseExternalConfigStoreForFile(map[string]any{
    "languageOptions": map[string]any{
      "parser": map[string]any{},
    },
    "plugins": map[string]any{
      "@typescript-eslint": map[string]any{},
    },
    "rules": map[string]any{
      "@typescript-eslint/no-explicit-any": "error",
    },
  }, "/project")
  if err != nil {
    t.Fatalf("unexpected error: %v", err)
  }
  if !store.WantsESLintRuntime() {
    t.Fatal("runtime-only fields should request ESLint runtime")
  }
  if !store.RequiresESLintRuntime() {
    t.Fatal("runtime-only fields should require ESLint runtime")
  }
}
