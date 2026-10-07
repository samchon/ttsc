package linthost

import "testing"

// TestCommandFormatTestCallHug preserves nine authored call layouts around
// isTestCall's syntactic callee and first-argument gates. Recognized calls hug
// their callback despite a long description; non-pattern callees use ordinary
// argument layouts. Callback bodies are source fixtures, not executed tests.
//
// Each source is an independent expected fixed point at printWidth 80;
// no external formatter or test framework is invoked.
//
//  1. Seed nine authored test-shaped or look-alike call layouts at width 80.
//  2. Run `ttsc format` with the default format block on each.
//  3. Require every file byte-identical.
//
// @evidence contracts/testing.md#behavioral-verification Nine subcases run the in-process `format` command on authored layouts and require each unchanged: overflowing descriptions hugging the callback (plain, `.only`, async, three-parameter, `test.fixme`), a short description with a multiline block callback still hugged, and non-test shapes (`notATest`, a non-string first argument, `myRunner.todo`) behaving as ordinary calls.
// @evidence contracts/testing.md#independent-expectations Complete authored expected sources preserve callee/member names, description strings, callback parameter counts and operations, await, and dynamic first arguments independently of formatter output. No external oracle or fixture callback is executed.
// @evidence contracts/testing.md#distinguishing-cases Hugging cases are contrasted with three gates: callee name (notATest, myRunner.todo explode), first-argument kind (dynamicName stays an ordinary short call) and fitting width. All are fixed points, so none shows a flat input being rewritten.
// @evidence contracts/testing.md#execution-ownership In-process Go unit: each subcase calls run with the format subcommand on a temp-dir project via assertFormatUnchanged; no child process, built binary or installed consumer.
func TestCommandFormatTestCallHug(t *testing.T) {
  // The core shape: an overflowing description still hugs the callback.
  t.Run("long_description_hugs_callback", func(t *testing.T) {
    assertFormatUnchanged(t, `test("issue #173325: wrong interpretations of special keys (e.g. [Equal] is mistaken for V)", () => {
  doThing();
});
`)
  })
  // A `.only` member chain on a test callee is recognized.
  t.Run("member_only_chain_hugs", func(t *testing.T) {
    assertFormatUnchanged(t, `it.only("a focused test whose description is long enough to spill past the eighty col", () => {
  expect(1).toBe(1);
});
`)
  })
  // An async arrow callback hugs the same way.
  t.Run("async_arrow_callback_hugs", func(t *testing.T) {
    assertFormatUnchanged(t, `it("inner test with a description that is sufficiently long to overflow eighty cols", async () => {
  await run();
});
`)
  })
  // This two-argument recognized call accepts a three-parameter callback;
  // the three-argument numeric-timeout predicate has a separate <=1 gate.
  t.Run("multi_param_callback_hugs", func(t *testing.T) {
    assertFormatUnchanged(t, `test("description long enough to overflow the eighty column print width boundary now", (a, b, c) => {
  x();
});
`)
  })
  // A NON-test callee with the identical shape explodes — the hug is gated on
  // the callee name, not the argument shape.
  t.Run("non_test_callee_explodes", func(t *testing.T) {
    assertFormatUnchanged(t, `notATest(
  "this identifier is not a recognized test callee so it should explode normally",
  () => {
    doThing();
  },
);
`)
  })
  // A short description retains the three-line block callback's hugged layout.
  t.Run("short_test_call_stays_flat", func(t *testing.T) {
    assertFormatUnchanged(t, `test("short", () => {
  ok();
});
`)
  })
  // A test callee whose first argument is NOT a string is not a test call and
  // reflows by the ordinary rules.
  t.Run("non_string_first_arg_not_test_call", func(t *testing.T) {
    assertFormatUnchanged(t, "test(dynamicName, () => ok());\n")
  })
  // The recognized test.fixme pattern hugs past the width.
  t.Run("test_fixme_member_hugs", func(t *testing.T) {
    assertFormatUnchanged(t, `test.fixme("a description long enough to overflow eighty columns for sure here ok", () => {
  run();
});
`)
  })
  // A non-pattern member callee (`myRunner.todo`) is NOT a test call even though
  // `todo` is a common test tail; the complete base/member pattern matters.
  t.Run("non_pattern_member_callee_explodes", func(t *testing.T) {
    assertFormatUnchanged(t, `myRunner.todo(
  "a description long enough to overflow eighty columns for sure here okay",
  () => {
    run();
  },
);
`)
  })
}
