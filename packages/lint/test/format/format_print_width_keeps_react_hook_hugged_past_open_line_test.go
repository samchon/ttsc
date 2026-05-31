package linthost

import "testing"

// TestFormatPrintWidthKeepsReactHookHuggedPastOpenLine pins the over-break fix:
// a genuine React-hook deps call (zero-parameter block-bodied arrow + array)
// keeps its callback hugged even when the hook name pushes the open `name(() => {`
// line past printWidth. Prettier's isReactHookCallWithDepsArray path never
// explodes the arguments (no fallback) — it lets the open line overflow.
// Without HugFirstForce, ttsc fell to the exploded one-arg-per-line layout.
func TestFormatPrintWidthKeepsReactHookHuggedPastOpenLine(t *testing.T) {
  assertFormatUnchanged(t, `useAnExtremelyLongCustomHookNameThatDefinitelyPushesTheOpenParenLineWayPastEighty(() => {
  doStuff();
}, [firstDep]);
`)
}
