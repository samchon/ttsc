package linthost

import "testing"

// TestCommandFormatRound2HugFixes preserves five authored argument-list layouts
// around numeric-array, empty-object and callback-parameter hugging boundaries.
// Full literals are independent expectations; no external formatter or React
// runtime is invoked.
//
//  1. Seed five authored call layouts around the hugging predicates.
//  2. Run `ttsc format` with the default format block on each.
//  3. Require every file byte-identical.
//
// @evidence contracts/testing.md#behavioral-verification Five subcases run the in-process `format` command on authored layouts and require each unchanged: a numeric array as last argument exploded, a non-numeric array last argument hugged, an empty-object last argument exploded, a zero-parameter React-hook callback with a deps array hugged, and a one-parameter callback with an array exploded.
// @evidence contracts/testing.md#independent-expectations Complete authored literals preserve callee names, every array element, argument order and callback operations independently of formatter output. No external formatter oracle is generated.
// @evidence contracts/testing.md#distinguishing-cases Numeric and non-numeric last arrays contrast explosion and hugging; zero- and one-parameter callbacks contrast first-argument hugging with an array. Inputs also differ in names, contents and widths, so these are not otherwise-identical one-property pairs. The empty-object case has no non-empty-object counterpart here. All five are fixed points, without flat-to-broken rewrite assertions.
// @evidence contracts/testing.md#execution-ownership In-process Go unit: each subcase calls run with the format subcommand on a temp-dir project via assertFormatUnchanged; no child process, built binary or installed consumer.
func TestCommandFormatRound2HugFixes(t *testing.T) {
  // A concisely-printed NUMERIC array as the last of two-plus args does NOT hug
  // under shouldHugLastArgument's numeric-array exclusion: it fills on its
  // own line and the list explodes.
  t.Run("numeric_array_last_arg_explodes", func(t *testing.T) {
    assertFormatUnchanged(t, `drawPolygonXXXXXXXX(
  contextObject,
  [12, 34, 56, 78, 90, 11, 22, 33, 44, 55, 66, 77, 88],
);
`)
  })
  // A non-numeric array last arg DOES hug (the array breaks but rides the
  // parens) — the numeric exclusion must not suppress this layout.
  t.Run("non_numeric_array_last_arg_hugs", func(t *testing.T) {
    assertFormatUnchanged(t, `configureRoutes(someRouterInstanceName, [
  "alphaRoute",
  "bravoRoute",
  "charlieRoute",
]);
`)
  })
  // An EMPTY object as the last arg is not expandable (lastArgHuggableShape requires
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
  // A ZERO-parameter arrow callback + array qualifies for the syntax-based
  // deps-array hug even though useEffectX is not an imported framework API.
  t.Run("react_hook_zero_param_deps_array_hugs", func(t *testing.T) {
    assertFormatUnchanged(t, `useEffectX(() => {
  doThing();
  doMoreStuffHereToOverflowTheWidthForSure();
}, [aaaa, bbbb, cccc]);
`)
  })
  // A parameterized callback does not qualify for the non-empty deps-array
  // first-argument hug; this assertion is about syntax, not framework loading.
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
