package linthost

import "testing"

// TestEngineRequiresTypeCheckerForTypeAwareRule verifies type-aware built-ins
// keep the historical single-checker path.
//
// awaitThenable calls ctx.Checker.GetTypeAtLocation. Running that rule without
// a checker would silently drop diagnostics, while running it against a
// multi-checker program can resolve cross-file types through the wrong checker.
//
// 1. Build an engine with awaitThenable enabled.
// 2. Ask whether the engine needs a type checker.
// 3. Assert the answer is true.
func TestEngineRequiresTypeCheckerForTypeAwareRule(t *testing.T) {
  engine := NewEngine(RuleConfig{"await-thenable": SeverityError})
  if !engine.NeedsTypeChecker() {
    t.Fatal("awaitThenable did not request a type checker")
  }
}
