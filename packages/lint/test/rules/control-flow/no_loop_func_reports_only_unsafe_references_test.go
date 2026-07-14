package linthost

import "testing"

// TestNoLoopFuncReportsOnlyUnsafeReferences verifies mutable captures, exact
// variable names, symbol identity, nested loop borders, and source ranges.
//
// A syntax-only walk cannot distinguish the iteration-local binding from the
// two bindings whose later writes make the closures unsafe. The oracle expects
// one diagnostic per closure and names only the mutable upper-scope symbols.
//
// 1. Create closures over outer, var-loop, nested-loop, and per-iteration names.
// 2. Mutate only bindings whose writes cross the applicable loop border.
// 3. Assert exact function ranges and ESLint-compatible unsafe-name messages.
func TestNoLoopFuncReportsOnlyUnsafeReferences(t *testing.T) {
  source := `let first = 0;
let second = 0;
for (var index = 0; index < 2; index++) {
  const closure = () => first + index + second;
  void closure;
}
first = 1;
second = 1;

function nested(): void {
  let outer = 0;
  while (outer < 2) {
    let between = 0;
    for (let iteration = 0; iteration < 2; iteration++) {
      const closure = function named() { return outer + between + iteration; };
      void closure;
    }
    between = 1;
    outer++;
  }
}
void nested;

let defaulted = 0;
for (let iteration = 0; iteration < 1; iteration++) {
  const closure = (value = defaulted) => value;
  void closure;
}
defaulted = 1;

let doValue = 0;
do {
  const closure = () => doValue;
  void closure;
  doValue++;
} while (doValue < 1);
`
  got := runNoLoopFunc(t, source)
  assertNoLoopFuncFindings(
    t,
    got,
    noLoopFuncFinding{
      line:    4,
      target:  "() => first + index + second",
      message: "Function declared in a loop contains unsafe references to variable(s) 'first', 'index', 'second'.",
    },
    noLoopFuncFinding{
      line:    15,
      target:  "function named() { return outer + between + iteration; }",
      message: "Function declared in a loop contains unsafe references to variable(s) 'outer', 'between'.",
    },
    noLoopFuncFinding{
      line:    26,
      target:  "(value = defaulted) => value",
      message: "Function declared in a loop contains unsafe references to variable(s) 'defaulted'.",
    },
    noLoopFuncFinding{
      line:    33,
      target:  "() => doValue",
      message: "Function declared in a loop contains unsafe references to variable(s) 'doValue'.",
    },
  )
}
