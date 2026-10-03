package linthost

import "testing"

// TestNoLoopFuncIIFEBoundaries verifies the rule's IIFE exemption boundaries.
//
// The rule exempts unreferenced synchronous non-generator IIFEs. Returned
// nested closures, referenced named IIFEs, async functions, and generators
// retain ordinary unsafe-capture analysis. These inputs distinguish that
// conservative policy, not actual escape or deferred execution of each closure.
//
// 1. Invoke safe arrow and named synchronous functions inside a loop.
// 2. Add a returned closure, self-reference, async IIFE, and generator IIFE.
// 3. Assert only the four nonexempt function ranges are reported.
//
// @evidence contracts/testing.md#behavioral-verification Checker-backed findings match the four authored nonexempt function ranges and unsafe-variable message.
// @evidence contracts/testing.md#independent-expectations The supported policy exempts an unreferenced synchronous non-generator IIFE. Literal nested-closure, self-reference, async and generator categories retain capture checking; the authored ranges/messages specify this policy independently of findings, without proving actual escape or suspension.
// @evidence contracts/testing.md#distinguishing-cases Immediate arrow and unreferenced named sync call stay clean; returned closure, referenced self, async IIFE and generator IIFE report.
// @evidence contracts/testing.md#execution-ownership TestNoLoopFuncIIFEBoundaries is selected in the shared Go unit population. It calls runNoLoopFunc and assertNoLoopFuncFindings through the owning Engine with a real Program/Checker; all authored in-source cases belong to this entry. No installed consumer, native artifact build or real product host runs.
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
