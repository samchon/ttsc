package linthost

import (
  "strings"
  "testing"
)

// TestProjectRuleConfigRejectsAnyFilesSelector verifies a project rule cannot
// appear in a file-scoped config object, even when disabled or scoped by an
// explicitly empty selector.
//
// Project state has no file identity, so accepting either form would make its
// resolved status depend on a synthetic or first source file. The parser must
// retain selector presence separately from the selector's pattern count.
//
//  1. Parse non-empty and empty `files` selectors containing a project rule.
//  2. Resolve the registered project-rule name.
//  3. Assert both declarations are rejected as scoped mentions.
func TestProjectRuleConfigRejectsAnyFilesSelector(t *testing.T) {
  const name = "project-test/scoped"
  cases := []map[string]any{
    {
      "files": []any{"src/**"},
      "rules": map[string]any{name: "off"},
    },
    {
      "files": []any{},
      "rules": map[string]any{name: []any{"error", map[string]any{"mode": "strict"}}},
    },
  }
  for index, raw := range cases {
    store, err := parseExternalConfigStore(raw, t.TempDir())
    if err != nil {
      t.Fatalf("case %d parse failed: %v", index, err)
    }
    _, err = store.ResolveProjectRules([]string{name})
    if err == nil || !strings.Contains(err.Error(), "cannot be configured in an entry with files") {
      t.Fatalf("case %d should reject scoped project rule, got %v", index, err)
    }
  }
}
