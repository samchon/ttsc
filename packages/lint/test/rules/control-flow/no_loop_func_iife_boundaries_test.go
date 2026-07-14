package linthost

import "testing"

// TestNoLoopFuncIIFEBoundaries verifies which immediately invoked functions
// are execution boundaries and which can outlive the current iteration.
//
// Only unreferenced synchronous non-generator IIFEs execute completely in the
// iteration. Returned nested closures, referenced named IIFEs, async functions,
// and generators retain the ordinary unsafe-capture analysis.
//
// 1. Invoke safe arrow and named synchronous functions inside a loop.
// 2. Add a returned closure, self-reference, async IIFE, and generator IIFE.
// 3. Assert only the four escaping/deferred function ranges are reported.
func TestNoLoopFuncIIFEBoundaries(t *testing.T) {
  source := `let outer = 0;
for (let iteration = 0; iteration < 1; iteration++) {
  (() => outer)();
  (function named() { return outer; })();
  (() => () => outer)();
  (function self() { return self && outer; })();
  (async () => outer)();
  (function* () { yield outer; })();
}
outer = 1;
`
  message := "Function declared in a loop contains unsafe references to variable(s) 'outer'."
  assertNoLoopFuncFindings(
    t,
    runNoLoopFunc(t, source),
    noLoopFuncFinding{line: 5, target: "() => outer", message: message},
    noLoopFuncFinding{line: 6, target: "function self() { return self && outer; }", message: message},
    noLoopFuncFinding{line: 7, target: "async () => outer", message: message},
    noLoopFuncFinding{line: 8, target: "function* () { yield outer; }", message: message},
  )
}
