package linthost

import "testing"

// TestParseConfigStorePromotesGlobalIgnoresWithFormatBlock verifies that a
// config object whose only rule surface is a `format` block still promotes a
// top-level `ignores` (no `files`) to a global ignore.
//
// The rules-branch early return that swallowed the promotion triggered on
// `hasRules || hasFormat`, so a format-only config (`format: {...}` plus
// `ignores`, common for "format everything except generated output") leaked
// its expanded `format/*` rules onto the ignored paths exactly like a `rules`
// config did. The fix must cover both halves of that condition, not just the
// `rules` one.
//
//  1. Parse one object with a `format` block (severity warning, so format
//     rules are active) plus `ignores` and no `files`.
//  2. Resolve an ignored path and an ordinary path.
//  3. Assert the ignored path is globally ignored while the ordinary path
//     keeps the expanded format rules.
func TestParseConfigStorePromotesGlobalIgnoresWithFormatBlock(t *testing.T) {
  store, err := parseExternalConfigStore(map[string]any{
    "ignores": []any{"generated/**"},
    "format":  map[string]any{"severity": "warning"},
  }, "/project")
  if err != nil {
    t.Fatalf("parseExternalConfigStore: %v", err)
  }

  ignored := store.ResolveRules("/project/generated/schema.ts")
  if !ignored.Ignored {
    t.Fatalf("generated/schema.ts: want Ignored=true, got %+v", ignored)
  }
  if len(ignored.Rules) != 0 {
    t.Fatalf("generated/schema.ts: format rules leaked onto an ignored file: %v", ignored.Rules)
  }

  main := store.ResolveRules("/project/src/main.ts")
  if main.Ignored {
    t.Fatal("src/main.ts must not be ignored")
  }
  if len(main.Rules) == 0 {
    t.Fatal("src/main.ts: expected the expanded format rules to apply")
  }
}
