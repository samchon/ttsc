package linthost

import (
  "testing"
)

// TestParseExternalConfigStoreRespectsBasePath verifies that a `basePath` key restricts glob
// matching to the named subdirectory of the project root.
//
// When a flat-config entry declares `basePath: "packages/app"`, its `files` patterns must only
// match source files rooted under that directory. A regression that ignored basePath would apply
// the entry's rules to every file in the project. This test uses two files — one inside and one
// outside basePath — to confirm the boundary is enforced at the ResolveRules call site.
//
// 1. Build a one-entry flat-config array with basePath, files glob, and a rule.
// 2. Parse through parseExternalConfigStore.
// 3. Assert the in-scope file gets the rule and the out-of-scope file does not.
func TestParseExternalConfigStoreRespectsBasePath(t *testing.T) {
  store, err := parseExternalConfigStore([]any{
    map[string]any{
      "basePath": "packages/app",
      "files":    []any{"**/*.ts"},
      "rules": map[string]any{
        "no-var": "error",
      },
    },
  }, "/project")
  if err != nil {
    t.Fatalf("unexpected error: %v", err)
  }

  matched := store.ResolveRules("/project/packages/app/src/main.ts")
  if matched.Rules.Severity("no-var") != SeverityError {
    t.Fatalf("basePath file should match no-var, got %+v", matched.Rules)
  }
  outside := store.ResolveRules("/project/packages/other/src/main.ts")
  if outside.Rules.Severity("no-var") != SeverityOff {
    t.Fatalf("outside basePath should not match no-var, got %+v", outside.Rules)
  }
}
