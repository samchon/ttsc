package linthost

import "testing"

// TestCommandFormatTestCallHug pins Prettier's isTestCall special case: a
// test-framework call (`it` / `test` / `describe`, with focus/skip prefixes
// and `.only` / `.skip` member chains) hugs its trailing callback onto the
// open-paren line even when the description string pushes that line past
// printWidth. Prettier never explodes such a call's arguments. The boundary:
// the callee name must match, the first argument must be a string/template,
// and a non-test callee with the same shape explodes instead.
//
// Each source is the Prettier-canonical output at printWidth 80, so format
// must keep it byte-identical.
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
  // The callback's parameter count does not matter (verified against Prettier):
  // even a three-parameter callback hugs.
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
  // A short test call still collapses to one flat line when it fits (the
  // all-flat option survives the dropped exploded fallback).
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
}
