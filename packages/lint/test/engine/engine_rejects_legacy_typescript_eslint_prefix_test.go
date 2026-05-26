package linthost

import "testing"

// TestEngineRejectsLegacyTypescriptEslintPrefix verifies that the migrated
// taxonomy does NOT silently accept the legacy `@typescript-eslint/<id>` config
// key form. The clean-break decision (issue #140) requires that legacy ids fall
// through to the `UnknownRules()` warning path rather than aliasing to the
// canonical `typescript/<id>`. A future "convenience alias" PR must trip this
// test before re-introducing the alias map.
//
//  1. Build an engine with `@typescript-eslint/no-explicit-any` enabled.
//  2. Inspect `UnknownRules()` and `EnabledRules()`.
//  3. Assert the legacy name surfaces as unknown and the canonical id is NOT
//     auto-enabled.
func TestEngineRejectsLegacyTypescriptEslintPrefix(t *testing.T) {
  engine := NewEngine(RuleConfig{
    "@typescript-eslint/no-explicit-any": SeverityError,
  })
  unknown := engine.UnknownRules()
  if len(unknown) != 1 || unknown[0] != "@typescript-eslint/no-explicit-any" {
    t.Fatalf("want [@typescript-eslint/no-explicit-any] in unknown, got %v", unknown)
  }
  if _, ok := engine.EnabledRules()["typescript/no-explicit-any"]; ok {
    t.Errorf("legacy `@typescript-eslint/no-explicit-any` must NOT alias to canonical `typescript/no-explicit-any`")
  }
}
