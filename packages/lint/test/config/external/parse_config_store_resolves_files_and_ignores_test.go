package linthost

import (
  "testing"
)

// TestParseConfigStoreResolvesFilesAndIgnores verifies that per-file scoping
// and global ignores are respected when resolving rules for individual source
// paths.
//
// A config file is a single `ITtscLintConfig` object, but its `extends` chain
// produces one `ConfigEntry` per file. ResolveRules must apply entries whose
// `files` glob matches the requested path while treating an `ignores`-only
// entry as a global ignore pattern. A regression that applied all entries
// unconditionally would disable "noConsole" for non-test files and fail to
// ignore generated files.
//
//  1. Build a ConfigStore with a base entry, a test-file `files` override, and
//     an `ignores`-only entry.
//  2. Resolve rules for three absolute source paths.
//  3. Assert each path resolves to the expected rules and ignored state.
func TestParseConfigStoreResolvesFilesAndIgnores(t *testing.T) {
  store := &ConfigStore{
    entries: []ConfigEntry{
      {
        BaseDir: "/project",
        Rules: RuleConfig{
          "noVar":     SeverityError,
          "noConsole": SeverityWarn,
        },
      },
      {
        BaseDir: "/project",
        Files:   []string{"src/**/*.test.ts"},
        Rules:   RuleConfig{"noConsole": SeverityOff},
      },
      {
        BaseDir:    "/project",
        Ignores:    []string{"src/generated/**"},
        IgnoreOnly: true,
      },
    },
  }

  main := store.ResolveRules("/project/src/main.ts")
  if main.Ignored {
    t.Fatal("main.ts should not be ignored")
  }
  if main.Rules.Severity("noVar") != SeverityError || main.Rules.Severity("noConsole") != SeverityWarn {
    t.Fatalf("main.ts rules not resolved correctly: %+v", main.Rules)
  }

  testFile := store.ResolveRules("/project/src/example.test.ts")
  if testFile.Ignored {
    t.Fatal("example.test.ts should not be ignored")
  }
  if testFile.Rules.Severity("noVar") != SeverityError || testFile.Rules.Severity("noConsole") != SeverityOff {
    t.Fatalf("example.test.ts rules not resolved correctly: %+v", testFile.Rules)
  }

  generated := store.ResolveRules("/project/src/generated/schema.ts")
  if !generated.Ignored {
    t.Fatalf("generated file should be ignored, got %+v", generated)
  }
}
