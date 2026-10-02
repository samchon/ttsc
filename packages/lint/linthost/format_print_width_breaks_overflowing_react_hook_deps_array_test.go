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
//
// @evidence contracts/testing.md#behavioral-verification Runs the in-process `format` command on a `useEffect(() => {...}, [...])` call whose callback body is hugged and whose deps array is already broken one element per line (the flat array would overflow), and requires the file byte-identical.
// @evidence contracts/testing.md#independent-expectations The source is an authored literal in the layout the test comment attributes to Prettier's React-hook handling (callback hugged, deps array broken); it is its own expected output. It is a fixed point, so it does not show a flat input being rewritten into this layout.
// @evidence contracts/testing.md#distinguishing-cases One fixed-point case for the overflowing-deps branch; the short-deps case that stays flat is covered elsewhere. A formatter that did nothing, or one that exploded the whole call instead of hugging the callback, would differ only in the second case.
// @evidence contracts/testing.md#execution-ownership In-process Go unit: calls run with the format subcommand on a temp-dir project via assertFormatUnchanged; no child process, built binary or installed consumer.
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
