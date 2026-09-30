package linthost

import "testing"

// TestCommandFormatRound2HugFixes pins the round-2 review-cycle corrections to
// the argument-hugging predicates, each an over-match that mis-shaped fitting
// code and was caught by comparing the Go predicates 1:1 with prettier 3.8.3
// source. All expected outputs are the pinned prettier 3.8.3 oracle.
//
//  1. Exercise the authored command format round2 hug fixes fixtures through the Go format dispatcher.
//  2. Require the exact authored output or rejection result for each fixture.
// @evidence contracts/testing.md#behavioral-verification The in-process format command exercises round2 hug fixes and compares the complete resulting fixture text with the authored answer, so convergence alone cannot certify a wrong rewrite.
// @evidence contracts/testing.md#independent-expectations The literal source or expected output is the independent answer key described above; the command result is never used to manufacture its expected bytes. Preservation assertions own only their canonical inputs and do not establish correctness for arbitrary malformed layout.
// @evidence contracts/testing.md#distinguishing-cases Named subcases retain these distinct inputs and failure identities: numeric_array_last_arg_explodes, non_numeric_array_last_arg_hugs, empty_object_last_arg_explodes, react_hook_zero_param_deps_array_hugs, param_callback_with_array_explodes. Each keeps its own assertions under this one discoverable entry.
// @evidence contracts/testing.md#execution-ownership TestCommandFormatRound2HugFixes owns the named subcases below through the Go format dispatcher and disposable JSON-configured source fixtures, without a child product host or installed consumer.
func TestCommandFormatRound2HugFixes(t *testing.T) {
  // A concisely-printed NUMERIC array as the last of two-plus args does NOT hug
  // (prettier's shouldExpandLastArg `!isConciselyPrintedArray` exclusion): it
  // fills on its own line and the list explodes.
  t.Run("numeric_array_last_arg_explodes", func(t *testing.T) {
    assertFormatUnchanged(t, `drawPolygonXXXXXXXX(
  contextObject,
  [12, 34, 56, 78, 90, 11, 22, 33, 44, 55, 66, 77, 88],
);
`)
  })
  // A non-numeric array last arg DOES hug (the array breaks but rides the
  // parens) — the numeric exclusion must not over-fire.
  t.Run("non_numeric_array_last_arg_hugs", func(t *testing.T) {
    assertFormatUnchanged(t, `configureRoutes(someRouterInstanceName, [
  "alphaRoute",
  "bravoRoute",
  "charlieRoute",
]);
`)
  })
  // An EMPTY object as the last arg is not expandable (couldExpandArg requires
  // a non-empty literal), so the list explodes instead of hugging `{}`.
  t.Run("empty_object_last_arg_explodes", func(t *testing.T) {
    assertFormatUnchanged(t, `wrapInThingyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX(
  alphaValue,
  betaValue,
  gammaValue,
  {},
);
`)
  })
  // A ZERO-parameter arrow callback + array (the React-hook deps shape) still
  // hugs first — the over-match fix must not break it.
  t.Run("react_hook_zero_param_deps_array_hugs", func(t *testing.T) {
    assertFormatUnchanged(t, `useEffectX(() => {
  doThing();
  doMoreStuffHereToOverflowTheWidthForSure();
}, [aaaa, bbbb, cccc]);
`)
  })
  // With a PARAMETER on the callback it is not a React-hook call, so the list
  // explodes (the over-match this round fixed).
  t.Run("param_callback_with_array_explodes", func(t *testing.T) {
    assertFormatUnchanged(t, `subscribeToThingsXXXX(
  (event) => {
    handleStuff();
  },
  [depAlpha, depBeta, depGamma, depDelta, depEpsilonXXXXXXXXXXXXXXXXXXX],
);
`)
  })
}
