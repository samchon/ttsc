package linthost

import "testing"

// TestCommandFormatMultipleCallbacks pins Prettier 3's function-composition
// rule: a call carrying two or more function/arrow arguments explodes onto
// one-argument-per-line even when the whole call fits on a single line
// (`promise.then(() => a, () => b)`). The boundary is exactly two functions,
// a single callback (with any number of plain trailing/leading args) stays
// inline, and a decorator hugging a huggable trailing argument is exempt.
//
// Every source is the Prettier-canonical output at printWidth 80, so format
// must keep it byte-identical (the exploded forms carry the trailing comma).
func TestCommandFormatMultipleCallbacks(t *testing.T) {
  // Two short arrows that fit flat: explode (the core async.then idiom).
  t.Run("two_arrows_explode_even_when_flat_fits", func(t *testing.T) {
    assertFormatUnchanged(t, `promise.then(
  () => this.consumed(),
  () => this.consumed(),
);
`)
  })
  // Two function expressions: explode the same way.
  t.Run("two_function_expressions_explode", func(t *testing.T) {
    assertFormatUnchanged(t, `qux(
  function () {
    return 1;
  },
  function () {
    return 2;
  },
);
`)
  })
  // Three arrows: still explode (the count is "two or more").
  t.Run("three_arrows_explode", func(t *testing.T) {
    assertFormatUnchanged(t, `mix(
  () => a,
  () => b,
  () => c,
);
`)
  })
  // Exactly one function, leading: stays inline (below the threshold).
  t.Run("single_leading_arrow_stays_inline", func(t *testing.T) {
    assertFormatUnchanged(t, "foo(() => a, plainArg);\n")
  })
  // Exactly one function, trailing: stays inline.
  t.Run("single_trailing_arrow_stays_inline", func(t *testing.T) {
    assertFormatUnchanged(t, "bar(plainArg, () => b);\n")
  })
  // A sole callback argument: inline (the common single-callback call).
  t.Run("sole_arrow_stays_inline", func(t *testing.T) {
    assertFormatUnchanged(t, "single(() => onlyOne);\n")
  })
  // Zero function arguments that fit: untouched (the rule never fires).
  t.Run("no_function_args_stays_inline", func(t *testing.T) {
    assertFormatUnchanged(t, "plain(alpha, bravo, charlie);\n")
  })
  // A decorator hugging its trailing object past two leading arrows is the
  // documented exemption: the arrows stay inline and only the object breaks,
  // NOT the full explode the plain-call counterpart gets.
  t.Run("decorator_hug_exempt_from_function_break", func(t *testing.T) {
    assertFormatUnchanged(t, `class C {
  @OneToMany(() => Post, (post) => post.category, {
    cascade: ["insert"],
  })
  posts: Post[];
}
`)
  })
}
