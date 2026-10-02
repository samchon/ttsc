package linthost

import "testing"

// TestCommandFormatRound2Coverage verifies that `ttsc format` leaves four
// authored call layouts byte-identical: the three-argument test-call
// branch with its positive and negative gate, and trailing-argument kinds that
// hug. Complete literals protect the callbacks, argument values and order;
// fixed-point preservation does not certify external formatter parity.
//
//  1. Seed four independently authored call layouts.
//  2. Run `ttsc format` with the default format block on each.
//  3. Require every file byte-identical.
//
// @evidence contracts/testing.md#behavioral-verification Four subcases run the in-process `format` command on authored layouts and require each unchanged: a three-argument test call with a numeric timeout whose block callback hugs, the same call with a two-parameter callback exploded, and first-argument hugs over element-access and property-access trailing arguments.
// @evidence contracts/testing.md#independent-expectations Complete sources are authored expected literals preserving descriptions, timeout 2500, callback parameters and operations, element-access keys and property names. They are independent of formatter output; no external formatter is invoked.
// @evidence contracts/testing.md#distinguishing-cases Covers the three-argument test-call branch with its positive and negative gate (zero-parameter versus two-parameter callback) and two trailing-argument kinds that hug. All are fixed points.
// @evidence contracts/testing.md#execution-ownership In-process Go unit: each subcase calls run with the format subcommand on a temp-dir project via assertFormatUnchanged; no child process, built binary or installed consumer.
func TestCommandFormatRound2Coverage(t *testing.T) {
  // The THREE-argument test call (numeric timeout) hugs its block callback past
  // an overflowing description, which is the 3-arg branch of isTestCall.
  t.Run("test_call_three_arg_timeout_hugs", func(t *testing.T) {
    assertFormatUnchanged(t, `test("a description that is long enough to overflow eighty columns easily here", () => {
  run();
}, 2500);
`)
  })
  // The 3-arg branch's negative gate: a TWO-parameter callback is not a test
  // call, so the arguments explode.
  t.Run("test_call_three_arg_two_param_explodes", func(t *testing.T) {
    assertFormatUnchanged(t, `test(
  "a description long enough to overflow the eighty column print width here ok",
  (a, b) => {
    x();
  },
  2500,
);
`)
  })
  // First-arg hug over an ELEMENT-access trailing arg (`lookup["k"]`): hugs —
  // isSimpleTrailingArg lists KindElementAccessExpression.
  t.Run("first_arg_element_access_trailing_hugs", func(t *testing.T) {
    assertFormatUnchanged(t, `const z = source.reduce((acc, value) => {
  acc.push(value);
  return acc;
}, lookup["initialAccumulatorKey"]);
`)
  })
  // First-arg hug over a PROPERTY-access trailing arg (`config.value`): hugs.
  t.Run("first_arg_property_access_trailing_hugs", func(t *testing.T) {
    assertFormatUnchanged(t, `const z = source.reduce((acc, value) => {
  acc.push(value);
  return acc;
}, config.initialAccumulatorValueNameHereThatIsModeratelyLong);
`)
  })
}
