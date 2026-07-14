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
