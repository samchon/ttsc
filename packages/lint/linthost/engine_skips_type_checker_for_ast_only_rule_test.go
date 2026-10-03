package linthost

import "testing"

// TestEngineSkipsTypeCheckerForAstOnlyRule verifies AST-only built-ins do not
// request Context.Checker.
//
// The checker gate is computed from the active rule set before Program
// creation. A rule such as noVar must therefore keep the engine on the
// AST-only path, otherwise it creates a standalone checker and serializes the
// file walk without making any type query.
//
// 1. Build an engine with only noVar enabled.
// 2. Ask whether the engine needs a type checker.
// 3. Assert the answer is false.
//
// @evidence contracts/testing.md#behavioral-verification NewEngine binds no-var alone at error severity without unknown rules or configuration errors and NeedsTypeChecker returns false.
// @evidence contracts/testing.md#independent-expectations No-var decides from the AST declaration-list flags, independently requiring no type queries; asserting active canonical identity prevents an empty or misspelled configuration from producing the same false answer.
// @evidence contracts/testing.md#distinguishing-cases Owns a valid active AST-only rule, contrasting both await-thenable and prefer-const positive checker-demand cases; it does not infer absence of a checker from missing rule registration.
// @evidence contracts/testing.md#execution-ownership Direct NewEngine construction and binding/capability accessors run in one Go process without parsing source, creating a Program or invoking the native compiler.
func TestEngineSkipsTypeCheckerForAstOnlyRule(t *testing.T) {
  engine := NewEngine(RuleConfig{"no-var": SeverityError})
  if err := engine.ConfigError(); err != nil {
    t.Fatalf("invalid engine configuration: %v", err)
  }
  if unknown := engine.UnknownRules(); len(unknown) != 0 {
    t.Fatalf("unexpected unknown rules: %v", unknown)
  }
  if enabled := engine.EnabledRules(); len(enabled) != 1 || enabled["no-var"] != SeverityError {
    t.Fatalf("requested rule was not bound at error severity: %v", enabled)
  }
  if engine.NeedsTypeChecker() {
    t.Fatal("noVar unexpectedly requested a type checker")
  }
}
