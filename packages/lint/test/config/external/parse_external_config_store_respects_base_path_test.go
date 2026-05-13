package main

import (
  "testing"
)

// TestParseExternalConfigStoreRespectsBasePath verifies base path matching.
//
// External config parsing accepts ESLint-style flat config data and reduces it into the lint
// engine rule model. These tests cover file matching, ignores, extends reduction, and
// runtime-only markers before the command path loads a real project.
//
// This scenario focuses on parse external config store respects base path. It protects the
// boundary between native fallback rules and cases that must delegate to an installed ESLint
// runtime.
//
// 1. Create the external config object or array for the branch.
// 2. Parse it through the external config reducer or store builder.
// 3. Assert resolved rules, ignored files, or runtime-required flags.
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
