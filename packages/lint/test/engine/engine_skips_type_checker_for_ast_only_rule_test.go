package linthost

import "testing"

// TestEngineSkipsTypeCheckerForAstOnlyRule verifies AST-only built-ins do not
// request Context.Checker.
//
// The checker gate is computed from the active rule set before Program
// creation. A common Vue/type-fest rule such as noVar must therefore keep the
// engine on the AST-only path, otherwise those projects still pay the old
// single-checker cost.
//
// 1. Build an engine with only noVar enabled.
// 2. Ask whether the engine needs a type checker.
// 3. Assert the answer is false.
func TestEngineSkipsTypeCheckerForAstOnlyRule(t *testing.T) {
  engine := NewEngine(RuleConfig{"noVar": SeverityError})
  if engine.NeedsTypeChecker() {
    t.Fatal("noVar unexpectedly requested a type checker")
  }
}
