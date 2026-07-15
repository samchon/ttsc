package linthost

import "testing"

// TestEngineRequiresTypeCheckerForTypeAwareRule verifies type-aware built-ins
// request the standalone lint checker path.
//
// awaitThenable calls ctx.Checker.GetTypeAtLocation. Running that rule without
// a checker would silently drop diagnostics. The marker makes loadProgram
// create one checker dedicated to lint instead of borrowing a Program pool
// member whose type graph belongs to only part of a multi-checker pass.
//
// 1. Build an engine with awaitThenable enabled.
// 2. Ask whether the engine needs a type checker.
// 3. Assert the answer is true.
func TestEngineRequiresTypeCheckerForTypeAwareRule(t *testing.T) {
  engine := NewEngine(RuleConfig{"typescript/await-thenable": SeverityError})
  if !engine.NeedsTypeChecker() {
    t.Fatal("awaitThenable did not request a type checker")
  }
}
