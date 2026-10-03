package linthost

import "testing"

// TestParseConfigStorePromotesGlobalIgnoresAlongsideRules verifies that a
// single config object carrying both `rules` and a top-level `ignores` (no
// `files`) still promotes the ignores to a global ignore entry.
//
// The authored `.next/**` pattern pins promotion independently of rule entries.
// collectConfigObject must reach the global-ignore branch before completing
// rule processing; attaching ignores only to the object's rules would leave
// other matching entries eligible. This object has no `extends` at all — the
// promotion must not depend on an extends chain being present.
//
//  1. Parse one object with `rules` plus `ignores` and no `files`.
//  2. Resolve an ignored path and an ordinary path.
//  3. Assert the ignored path resolves Ignored=true with no rules, and the
//     ordinary path still receives the object's rules.
//
// @evidence contracts/testing.md#behavioral-verification parseExternalConfigStore marks both nested .next output and exact next-env.d.ts ignored with an empty rule map and no-var off, while ordinary source remains included with no-var/error.
// @evidence contracts/testing.md#independent-expectations Top-level ignores without files exclude the entire chain even alongside rules; literal dot-directory and exact basename patterns independently determine inclusion.
// @evidence contracts/testing.md#distinguishing-cases Owns global ignores without extends, two pattern shapes and an ordinary positive source, preventing a rules-branch early return from hiding promotion.
// @evidence contracts/testing.md#execution-ownership This discoverable Go entry owns the case described above. Direct parseExternalConfigStore and ResolveRules calls observe two ignored paths and ordinary source from one authored object in the shared Go process; no Next.js install or native producer is needed.
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
    if len(resolved.Rules) != 0 {
      t.Fatalf("%s: globally ignored path retained rules: %+v", ignored, resolved.Rules)
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
