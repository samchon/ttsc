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
// other entries that independently select them.
//
//  1. Parse a config with `files`, `ignores`, and `rules`, then prepend an
//     authored base entry supplying no-var.
//  2. Resolve rules for a file matched by `files` but excluded by `ignores`.
//  3. Assert the file is NOT globally ignored and still receives the base
//     rule, while the entry's own rule does not apply.
//
// @evidence contracts/testing.md#behavioral-verification parseExternalConfigStore keeps a generated file globally lintable by its base no-var rule while suppressing only the scoped no-console entry, and applies no-console to normal source.
// @evidence contracts/testing.md#independent-expectations A files-plus-ignores entry refines its own match rather than excluding the whole chain; independently authored generated and ordinary paths establish which rule scopes may act.
// @evidence contracts/testing.md#distinguishing-cases Owns scoped ignore with a retained base entry and its adjacent selected source; global-ignore promotion is covered separately.
// @evidence contracts/testing.md#execution-ownership This discoverable Go entry owns the case described above. The authored scoped object reaches parseExternalConfigStore, then a base entry and two ResolveRules calls distinguish selected and excluded paths in-process; no extends script or native host is executed.
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
