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
//
// @evidence contracts/testing.md#behavioral-verification NewEngine binds prefer-const alone at error severity without unknown rules or configuration errors and NeedsTypeChecker returns true.
// @evidence contracts/testing.md#independent-expectations The built-in prefer-const rule resolves declaration and write symbols, independently requiring a checker; literal active rule identity prevents a missing registration from masquerading as a capability result.
// @evidence contracts/testing.md#distinguishing-cases Owns binding-analysis checker demand; await-thenable owns a different type-aware rule and no-var is the false AST-only complement. These cases inspect demand rather than execute a checker.
// @evidence contracts/testing.md#execution-ownership Direct NewEngine construction and ConfigError, UnknownRules, EnabledRules and NeedsTypeChecker observations run in one Go process; no Program, source fixture or native child is created.
func TestEngineRequiresTypeCheckerForPreferConst(t *testing.T) {
  engine := NewEngine(RuleConfig{"prefer-const": SeverityError})
  if err := engine.ConfigError(); err != nil {
    t.Fatalf("invalid engine configuration: %v", err)
  }
  if unknown := engine.UnknownRules(); len(unknown) != 0 {
    t.Fatalf("unexpected unknown rules: %v", unknown)
  }
  if enabled := engine.EnabledRules(); len(enabled) != 1 || enabled["prefer-const"] != SeverityError {
    t.Fatalf("requested rule was not bound at error severity: %v", enabled)
  }
  if !engine.NeedsTypeChecker() {
    t.Fatal("preferConst did not request a type checker")
  }
}
