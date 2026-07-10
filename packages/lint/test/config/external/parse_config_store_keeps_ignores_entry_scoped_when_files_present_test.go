package linthost

import (
  "testing"
)

// TestParseConfigStoreKeepsIgnoresEntryScopedWhenFilesPresent verifies that
// `ignores` alongside a `files` filter stays entry-scoped: it refines that
// entry's selection instead of becoming a global ignore.
//
// The global-ignore promotion (top-level `ignores` with no `files` excludes a
// file from the whole resolved chain) must not over-reach. When the author
// paired `ignores` with `files`, the ESLint-compatible reading is "apply these
// rules to `files` except `ignores`" — the excluded files are still linted by
// every other entry.
//
//  1. Parse a config whose object has `files`, `ignores`, and `rules`, and
//     whose `extends` target contributes a base rule.
//  2. Resolve rules for a file matched by `files` but excluded by `ignores`.
//  3. Assert the file is NOT globally ignored and still receives the base
//     rule, while the entry's own rule does not apply.
func TestParseConfigStoreKeepsIgnoresEntryScopedWhenFilesPresent(t *testing.T) {
  store, err := parseExternalConfigStore(map[string]any{
    "files":   []any{"src/**/*.ts"},
    "ignores": []any{"src/generated/**"},
    "rules":   map[string]any{"no-console": "error"},
  }, "/project")
  if err != nil {
    t.Fatalf("parseExternalConfigStore: %v", err)
  }
  store.entries = append([]ConfigEntry{{
    BaseDir: "/project",
    Rules:   RuleConfig{"no-var": SeverityError},
  }}, store.entries...)

  excluded := store.ResolveRules("/project/src/generated/schema.ts")
  if excluded.Ignored {
    t.Fatalf("files-scoped ignores must not become a global ignore, got %+v", excluded)
  }
  if excluded.Rules.Severity("no-var") != SeverityError {
    t.Fatalf("base rule must still apply outside the scoped entry, got %v", excluded.Rules.Severity("no-var"))
  }
  if excluded.Rules.Severity("no-console") != SeverityOff {
    t.Fatalf("scoped entry's rule must not apply to its ignored file, got %v", excluded.Rules.Severity("no-console"))
  }

  selected := store.ResolveRules("/project/src/main.ts")
  if selected.Rules.Severity("no-console") != SeverityError {
    t.Fatalf("scoped entry's rule must apply to selected files, got %v", selected.Rules.Severity("no-console"))
  }
}
