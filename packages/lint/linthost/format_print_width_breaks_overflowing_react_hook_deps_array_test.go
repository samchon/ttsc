package linthost

import "testing"

// TestFormatPrintWidthBreaksOverflowingReactHookDepsArray verifies the negative
// twin of the first-argument deps-array hug: when the deps array overflows the close
// line, the supported hook layout keeps the callback hugged and the deps array
// one element per line. The short-deps changing companion owns the nearby
// flat-array layout; this command fixture pins only the broken fixed point.
//
//  1. Seed a `useEffect` call whose callback is hugged and whose deps array is
//     already broken one element per line.
//  2. Run `ttsc format` with the default format block.
//  3. Require the file byte-identical.
//
// @evidence contracts/testing.md#behavioral-verification Runs the in-process `format` command on a `useEffect(() => {...}, [...])` call whose callback body is hugged and whose deps array is already broken one element per line (the flat array would overflow), and requires the file byte-identical.
// @evidence contracts/testing.md#independent-expectations The supported hook layout keeps the block callback attached and preserves an overflowing dependency array on separate lines. The complete authored source is its own expected output; this fixed point does not show a flat input changing or certify an installed formatter result.
// @evidence contracts/testing.md#distinguishing-cases This fixed-point case rejects exploding the call or flattening its overflowing array. Alone it cannot reject a formatter that does nothing; HugsFirstCallbackWithArrayArg separately requires a changed callback layout with a short array.
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
