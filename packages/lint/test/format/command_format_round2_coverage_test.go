package linthost

import "testing"

// TestCommandFormatRound2Coverage closes coverage gaps the round-2 review found:
// branches and trailing-arg kinds with no existing assertion. Each expected
// output is the pinned prettier 3.8.3 canonical form (idempotency = parity), so
// format must leave it byte-identical.
//
//  1. Exercise the authored command format round2 coverage fixtures through the Go format dispatcher.
//  2. Require the exact authored output or rejection result for each fixture.
// @evidence contracts/testing.md#behavioral-verification The in-process format command exercises round2 coverage and compares the complete resulting fixture text with the authored answer, so convergence alone cannot certify a wrong rewrite.
// @evidence contracts/testing.md#independent-expectations The literal source or expected output is the independent answer key described above; the command result is never used to manufacture its expected bytes. Preservation assertions own only their canonical inputs and do not establish correctness for arbitrary malformed layout.
// @evidence contracts/testing.md#distinguishing-cases Named subcases retain these distinct inputs and failure identities: test_call_three_arg_timeout_hugs, test_call_three_arg_two_param_explodes, first_arg_element_access_trailing_hugs, first_arg_property_access_trailing_hugs. Each keeps its own assertions under this one discoverable entry.
// @evidence contracts/testing.md#execution-ownership TestCommandFormatRound2Coverage owns the named subcases below through the Go format dispatcher and disposable JSON-configured source fixtures, without a child product host or installed consumer.
func TestCommandFormatRound2Coverage(t *testing.T) {
  // The THREE-argument test call (numeric timeout) hugs its block callback past
  // an overflowing description — the entire 3-arg branch of isTestCall was
  // previously untested.
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
  // isSimpleTrailingArg lists KindElementAccessExpression but it was untested.
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
