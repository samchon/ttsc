package linthost

import "testing"

// TestParseConfigStorePromotesGlobalIgnoresAlongsideRules verifies that a
// single config object carrying both `rules` and a top-level `ignores` (no
// `files`) still promotes the ignores to a global ignore entry.
//
// This is the root cause of the Next.js `.next/**` leak: collectConfigObject
// used to `return` from the rules branch before reaching the global-ignore
// promotion, so `ignores` was only attached (entry-scoped) to the object's
// own rules entry. The object shape here has no `extends` at all — the
// promotion must not depend on an extends chain being present.
//
//  1. Parse one object with `rules` plus `ignores` and no `files`.
//  2. Resolve an ignored path and an ordinary path.
//  3. Assert the ignored path resolves Ignored=true with no rules, and the
//     ordinary path still receives the object's rules.
func TestParseConfigStorePromotesGlobalIgnoresAlongsideRules(t *testing.T) {
  store, err := parseExternalConfigStore(map[string]any{
    "ignores": []any{".next/**/*.ts", "next-env.d.ts"},
    "rules":   map[string]any{"no-var": "error"},
  }, "/project")
  if err != nil {
    t.Fatalf("parseExternalConfigStore: %v", err)
  }

  for _, ignored := range []string{
    "/project/.next/types/validator.ts",
    "/project/next-env.d.ts",
  } {
    resolved := store.ResolveRules(ignored)
    if !resolved.Ignored {
      t.Fatalf("%s: want Ignored=true from the global ignores, got %+v", ignored, resolved)
    }
    if resolved.Rules.Severity("no-var") != SeverityOff {
      t.Fatalf("%s: rules leaked onto an ignored file: %v", ignored, resolved.Rules.Severity("no-var"))
    }
  }

  main := store.ResolveRules("/project/src/main.ts")
  if main.Ignored {
    t.Fatal("src/main.ts must not be ignored")
  }
  if main.Rules.Severity("no-var") != SeverityError {
    t.Fatalf("src/main.ts no-var: want error, got %v", main.Rules.Severity("no-var"))
  }
}
