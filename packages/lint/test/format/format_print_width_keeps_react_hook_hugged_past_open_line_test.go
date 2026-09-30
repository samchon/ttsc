package linthost

import "testing"

// TestFormatPrintWidthKeepsReactHookHuggedPastOpenLine pins the over-break fix:
// a genuine React-hook deps call (zero-parameter block-bodied arrow + array)
// keeps its callback hugged even when the hook name pushes the open `name(() => {`
// line past printWidth. Prettier's isReactHookCallWithDepsArray path never
// explodes the arguments (no fallback) — it lets the open line overflow.
// Without HugFirstForce, ttsc fell to the exploded one-arg-per-line layout.
//
//  1. Exercise the authored format print width keeps react hook hugged past open line fixtures through the Go format dispatcher.
//  2. Require the exact authored output or rejection result for each fixture.
// @evidence contracts/testing.md#behavioral-verification The in-process format command exercises format print width keeps react hook hugged past open line and compares the complete resulting fixture text with the authored answer, so convergence alone cannot certify a wrong rewrite.
// @evidence contracts/testing.md#independent-expectations The literal source or expected output is the independent answer key described above; the command result is never used to manufacture its expected bytes. Preservation assertions own only their canonical inputs and do not establish correctness for arbitrary malformed layout.
// @evidence contracts/testing.md#distinguishing-cases This case owns the supplied fixtures for the over-break fix: a genuine React-hook deps call (zero-parameter block-bodied arrow + array) keeps its callback hugged even when the hook name pushes the open `name(() => {` line past printWidth. Prettier's isReactHookCallWithDepsArray path never explodes the arguments (no fallback) — it lets the open line overflow. Without HugFirstForce, ttsc fell to the exploded one-arg-per-line layout. Neighboring hosts retain their separately named complementary inputs.
// @evidence contracts/testing.md#execution-ownership TestFormatPrintWidthKeepsReactHookHuggedPastOpenLine owns the named subcases below through the Go format dispatcher and disposable JSON-configured source fixtures, without a child product host or installed consumer.
func TestFormatPrintWidthKeepsReactHookHuggedPastOpenLine(t *testing.T) {
  assertFormatUnchanged(t, `useAnExtremelyLongCustomHookNameThatDefinitelyPushesTheOpenParenLineWayPastEighty(() => {
  doStuff();
}, [firstDep]);
`)
}
