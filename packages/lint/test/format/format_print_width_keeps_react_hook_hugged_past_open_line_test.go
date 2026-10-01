package linthost

import "testing"

// TestFormatPrintWidthKeepsReactHookHuggedPastOpenLine pins the over-break fix:
// a genuine React-hook deps call (zero-parameter block-bodied arrow + array)
// keeps its callback hugged even when the hook name pushes the open `name(() => {`
// line past printWidth. Prettier's isReactHookCallWithDepsArray path never
// explodes the arguments (no fallback) — it lets the open line overflow.
// Without HugFirstForce, ttsc fell to the exploded one-arg-per-line layout.
//
//  1. Seed a project with one already-hugged hook call whose name pushes the
//     open line past 80 columns.
//  2. Run the in-process format command with a default format block.
//  3. Require the file on disk to be byte-identical to the source.
// @evidence contracts/testing.md#behavioral-verification The in-process format command runs over one hook-with-deps call whose open line overflows 80 columns and the complete file text must equal the authored source, so exploding the arguments one per line (the defect) fails the equality.
// @evidence contracts/testing.md#independent-expectations The expected text is the hugged layout that Prettier's React-hook-with-deps-array rule produces, authored as a literal and equal to the input; it is not derived from the command result. This is a preservation assertion on one canonical input and does not establish correctness for arbitrary layouts.
// @evidence contracts/testing.md#distinguishing-cases This case owns the single overflow-tolerated hug: a zero-parameter block-bodied arrow plus a deps array stays hugged although the open line is past printWidth. Ordinary over-width calls that must break are owned by the sibling print-width reflow tests.
// @evidence contracts/testing.md#execution-ownership TestFormatPrintWidthKeepsReactHookHuggedPastOpenLine is one Go unit entry that calls the in-process format command through assertFormatUnchanged on a temporary project; it spawns no child product host and installs no consumer.
func TestFormatPrintWidthKeepsReactHookHuggedPastOpenLine(t *testing.T) {
  assertFormatUnchanged(t, `useAnExtremelyLongCustomHookNameThatDefinitelyPushesTheOpenParenLineWayPastEighty(() => {
  doStuff();
}, [firstDep]);
`)
}
