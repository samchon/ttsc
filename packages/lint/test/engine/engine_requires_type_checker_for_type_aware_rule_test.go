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
//
// @evidence contracts/testing.md#behavioral-verification NewEngine binds typescript/await-thenable alone at error severity without unknown rules or configuration errors and NeedsTypeChecker returns true.
// @evidence contracts/testing.md#independent-expectations Await-thenable inspects awaited expression types, independently requiring a checker; the literal canonical rule identity and error severity establish that the requested rule actually bound.
// @evidence contracts/testing.md#distinguishing-cases Owns promise-type checker demand versus no-var AST-only false and prefer-const symbol-analysis true; the asserted capability does not certify actual type queries or Program construction.
// @evidence contracts/testing.md#execution-ownership Direct NewEngine construction and its binding/capability accessors run in the shared Go process; no consumer project, checker Program or compiler child is needed for this metadata decision.
func TestEngineRequiresTypeCheckerForTypeAwareRule(t *testing.T) {
  engine := NewEngine(RuleConfig{"typescript/await-thenable": SeverityError})
  if err := engine.ConfigError(); err != nil {
    t.Fatalf("invalid engine configuration: %v", err)
  }
  if unknown := engine.UnknownRules(); len(unknown) != 0 {
    t.Fatalf("unexpected unknown rules: %v", unknown)
  }
  if enabled := engine.EnabledRules(); len(enabled) != 1 || enabled["typescript/await-thenable"] != SeverityError {
    t.Fatalf("requested rule was not bound at error severity: %v", enabled)
  }
  if !engine.NeedsTypeChecker() {
    t.Fatal("awaitThenable did not request a type checker")
  }
}
