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
//
// @evidence contracts/testing.md#behavioral-verification NewEngine exposes the legacy @typescript-eslint/no-explicit-any name as unknown and does not auto-enable its canonical counterpart; the canonical spelling binds normally.
// @evidence contracts/testing.md#independent-expectations The supported clean-break taxonomy independently requires the literal unknown legacy key and active canonical typescript/no-explicit-any error entry in the control engine.
// @evidence contracts/testing.md#distinguishing-cases Legacy and canonical configurations distinguish alias rejection from wholesale absence of the registered rule; directive spellings are exercised separately.
// @evidence contracts/testing.md#execution-ownership Actual engine construction and warning/dispatch accessors run directly in one Go process; no source walk, package text comparison or native CLI participates.
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
  canonical := NewEngine(RuleConfig{"typescript/no-explicit-any": SeverityError})
  if err := canonical.ConfigError(); err != nil {
    t.Fatalf("canonical configuration failed: %v", err)
  }
  if unknown := canonical.UnknownRules(); len(unknown) != 0 {
    t.Fatalf("canonical spelling was unknown: %v", unknown)
  }
  if enabled := canonical.EnabledRules(); len(enabled) != 1 || enabled["typescript/no-explicit-any"] != SeverityError {
    t.Fatalf("canonical spelling did not bind: %v", enabled)
  }
}
