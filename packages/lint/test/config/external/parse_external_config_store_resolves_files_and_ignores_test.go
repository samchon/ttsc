package linthost

import (
  "testing"
)

// TestParseExternalConfigStoreResolvesFilesAndIgnores verifies that per-file scoping and global
// ignores are respected when resolving rules for individual source paths.
//
// The store must apply config entries whose `files` glob matches the requested path while
// treating entries with `ignores` only (no `files`) as global ignore patterns. A regression
// that applied all entries unconditionally would disable "no-console" for non-test files and
// fail to ignore generated files. This test uses three absolute source paths to cover all three
// entry types in one pass.
//
// 1. Build a flat-config array with a base entry, a test-file override, and an ignores entry.
// 2. Parse through parseExternalConfigStore.
// 3. Assert each source path resolves to the expected rules and ignored state.
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
