package main

import (
  "testing"
)

// TestParseExternalConfigStoreResolvesFilesAndIgnores verifies file and ignore matching.
//
// External config parsing accepts ESLint-style flat config data and reduces it into the lint
// engine rule model. These tests cover file matching, ignores, extends reduction, and
// runtime-only markers before the command path loads a real project.
//
// This scenario focuses on parse external config store resolves files and ignores. It protects
// the boundary between native fallback rules and cases that must delegate to an installed
// ESLint runtime.
//
// 1. Create the external config object or array for the branch.
// 2. Parse it through the external config reducer or store builder.
// 3. Assert resolved rules, ignored files, or runtime-required flags.
func TestParseExternalConfigStoreResolvesFilesAndIgnores(t *testing.T) {
  store, err := parseExternalConfigStore([]any{
    map[string]any{
      "rules": map[string]any{
        "no-var":     "error",
        "no-console": "warn",
      },
    },
    map[string]any{
      "files": []any{"src/**/*.test.ts"},
      "rules": map[string]any{
        "no-console": "off",
      },
    },
    map[string]any{
      "ignores": []any{"src/generated/**"},
    },
  }, "/project")
  if err != nil {
    t.Fatalf("unexpected error: %v", err)
  }

  main := store.ResolveRules("/project/src/main.ts")
  if main.Ignored {
    t.Fatal("main.ts should not be ignored")
  }
  if main.Rules.Severity("no-var") != SeverityError || main.Rules.Severity("no-console") != SeverityWarn {
    t.Fatalf("main.ts rules not resolved correctly: %+v", main.Rules)
  }

  testFile := store.ResolveRules("/project/src/example.test.ts")
  if testFile.Ignored {
    t.Fatal("example.test.ts should not be ignored")
  }
  if testFile.Rules.Severity("no-var") != SeverityError || testFile.Rules.Severity("no-console") != SeverityOff {
    t.Fatalf("example.test.ts rules not resolved correctly: %+v", testFile.Rules)
  }

  generated := store.ResolveRules("/project/src/generated/schema.ts")
  if !generated.Ignored {
    t.Fatalf("generated file should be ignored, got %+v", generated)
  }
}
