package linthost

import "testing"

// TestFormatPrintWidthBreaksOverflowingReactHookDepsArray pins the negative twin
// of the first-argument deps-array hug: when the deps array overflows the close
// line, Prettier keeps the callback hugged but breaks the deps array
// one-element-per-line (its dedicated isReactHookCallWithDepsArray path prints
// the array through a normal breakable group). The short-deps case stays flat
// (covered elsewhere); this case must break.
//
//  1. Exercise the authored format print width breaks overflowing react hook deps array fixtures through the Go format dispatcher.
//  2. Require the exact authored output or rejection result for each fixture.
// @evidence contracts/testing.md#behavioral-verification The in-process format command exercises format print width breaks overflowing react hook deps array and compares the complete resulting fixture text with the authored answer, so convergence alone cannot certify a wrong rewrite.
// @evidence contracts/testing.md#independent-expectations The literal source or expected output is the independent answer key described above; the command result is never used to manufacture its expected bytes. Preservation assertions own only their canonical inputs and do not establish correctness for arbitrary malformed layout.
// @evidence contracts/testing.md#distinguishing-cases This case owns the supplied fixtures for the negative twin of the first-argument deps-array hug: when the deps array overflows the close line, Prettier keeps the callback hugged but breaks the deps array one-element-per-line (its dedicated isReactHookCallWithDepsArray path prints the array through a normal breakable group). The short-deps case stays flat (covered elsewhere); this case must break. Neighboring hosts retain their separately named complementary inputs.
// @evidence contracts/testing.md#execution-ownership TestFormatPrintWidthBreaksOverflowingReactHookDepsArray owns the named subcases below through the Go format dispatcher and disposable JSON-configured source fixtures, without a child product host or installed consumer.
func TestFormatPrintWidthBreaksOverflowingReactHookDepsArray(t *testing.T) {
  assertFormatUnchanged(t, `useEffect(() => {
  doSomethingWithTheValues();
}, [
  firstDependencyValueHere,
  secondDependencyValueHere,
  thirdDependencyValueHere,
]);
`)
}
