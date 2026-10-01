package linthost

import "testing"

// TestNoLoopFuncTreatsClassFieldInitializersAsVariableScopes verifies deferred
// class field writes cannot be mistaken for harmless source-order writes.
//
// ESLint gives each class field initializer its own variable scope because the
// initializer runs when an instance is created, not when the class is declared.
// Computed field names still run in the surrounding scope at declaration time.
//
// 1. Write outer bindings from a field initializer and a computed field name.
// 2. Capture both in loop-created closures with no later textual writes.
// 3. Assert only the deferred initializer write keeps its closure unsafe.
//
// @evidence contracts/testing.md#behavioral-verification Checker-backed findings require only the original fieldWritten closure range and its exact message, preserving computedNameWritten as clean.
// @evidence contracts/testing.md#independent-expectations Instance field initializers run when instances are created, while computed class names execute during declaration; the authored timing difference independently distinguishes deferred writes.
// @evidence contracts/testing.md#distinguishing-cases Deferred initializer write taints fieldWritten; declaration-time computed-name write leaves the later capture clean. The write-form and safe-binding tests own ordinary scope counterparts.
// @evidence contracts/testing.md#execution-ownership TestNoLoopFuncTreatsClassFieldInitializersAsVariableScopes is selected in the shared Go unit population. It calls runNoLoopFunc and assertNoLoopFuncFindings through the owning Engine with a real Program/Checker; all authored in-source cases belong to this entry. No installed consumer, native artifact build or real product host runs.
func TestNoLoopFuncTreatsClassFieldInitializersAsVariableScopes(t *testing.T) {
  source := `let fieldWritten = 0;
let computedNameWritten = 0;
class Writer {
  value = (fieldWritten = 1);
}
class KeyWriter {
  // @ts-ignore -- the scope behavior is independent of the class-key type restriction.
  [(computedNameWritten = 1)] = 0;
}
for (let iteration = 0; iteration < 1; iteration++) {
  const closure = () => fieldWritten;
  const safe = () => computedNameWritten;
  void [closure, safe];
}
void [Writer, KeyWriter];
`
  assertNoLoopFuncFindings(
    t,
    runNoLoopFunc(t, source),
    noLoopFuncFinding{
      line:    11,
      target:  "() => fieldWritten",
      message: "Function declared in a loop contains unsafe references to variable(s) 'fieldWritten'.",
    },
  )
}
