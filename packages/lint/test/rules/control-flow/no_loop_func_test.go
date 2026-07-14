package linthost

import "testing"

// TestRuleCorpusNoLoopFunc verifies the real-command corpus fixture's unsafe
// reference semantics through the same checker-backed native rule engine.
//
// The corpus is the end-to-end command oracle, while this package-local twin
// keeps its exact positive and negative cases visible in focused Go coverage.
//
// 1. Run the annotated fixture source with a real Program and checker.
// 2. Assert the outer mutable/var closure and returned closure are reported.
// 3. Assert safe lets, consts, no-capture closures, and a direct IIFE are not.
func TestRuleCorpusNoLoopFunc(t *testing.T) {
  source := `// Positive: a closure captures both an outer binding written after the loop
// begins and a var loop counter shared by every iteration.
let mutable = 0;
for (var index = 0; index < 2; index++) {
  // expect: no-loop-func error
  const unsafe = () => mutable + index;
  void unsafe;
}
mutable = 1;

// Negative: const and per-iteration let bindings cannot change underneath a
// closure from a different iteration.
const fixed = 1;
for (let iteration = 0; iteration < 2; iteration++) {
  const safe = () => fixed + iteration;
  const noCapture = () => 42;
  void [safe, noCapture];
}

// Negative: an unreferenced synchronous IIFE completes in this iteration.
for (let iteration = 0; iteration < 1; iteration++) {
  (() => mutable)();
}

// Positive: the nested closure returned by an IIFE can escape the iteration.
for (let iteration = 0; iteration < 1; iteration++) {
  // expect: no-loop-func error
  const escaped = (() => () => mutable)();
  void escaped;
}
mutable = 2;

JSON.stringify({ mutable, fixed });
`
  assertNoLoopFuncFindings(
    t,
    runNoLoopFunc(t, source),
    noLoopFuncFinding{
      line:    6,
      target:  "() => mutable + index",
      message: "Function declared in a loop contains unsafe references to variable(s) 'mutable', 'index'.",
    },
    noLoopFuncFinding{
      line:    28,
      target:  "() => mutable",
      message: "Function declared in a loop contains unsafe references to variable(s) 'mutable'.",
    },
  )
}
