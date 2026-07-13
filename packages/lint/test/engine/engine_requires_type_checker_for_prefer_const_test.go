package linthost

import "testing"

// TestEngineRequiresTypeCheckerForPreferConst verifies binding analysis requests a checker.
//
// `prefer-const` resolves declaration and write identifiers to TypeScript
// symbols. The engine must therefore acquire one checker and use the serial
// type-aware path whenever the rule is active.
//
//  1. Build an engine with only prefer-const enabled.
//  2. Query its checker requirement.
//  3. Assert the loader-facing flag is true.
func TestEngineRequiresTypeCheckerForPreferConst(t *testing.T) {
  engine := NewEngine(RuleConfig{"prefer-const": SeverityError})
  if !engine.NeedsTypeChecker() {
    t.Fatal("preferConst did not request a type checker")
  }
}
