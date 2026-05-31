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
  // An argument that is itself a call carrying a callback counts toward the
  // composition rule: `assert.strictEqual(arr.find((n) => n <= 0), undefined)`
  // explodes even though only one direct argument exists and it fits flat.
  t.Run("arg_is_call_with_callback_explodes", func(t *testing.T) {
    assertFormatUnchanged(t, `assert.strictEqual(
  arr.findLastMonotonous((n) => n <= 0),
  undefined,
);
`)
  })
  // The composed-call shape with a method chain and a plain trailing arg.
  t.Run("composed_map_call_with_trailing_arg_explodes", func(t *testing.T) {
    assertFormatUnchanged(t, `this.focusTrait.set(
  indexes.map((i) => this.element(i)),
  browserEvent,
);
`)
  })
  // Composition overrides last-argument hugging on a plain call: a trailing
  // block callback does NOT hug when a leading argument is a composed call.
  t.Run("composition_overrides_last_arg_hug", func(t *testing.T) {
    assertFormatUnchanged(t, `foo(
  bar.map((x) => x.id),
  () => {
    doSomethingInTheCallbackBodyHere();
  },
);
`)
  })
  // A single composed-call argument does NOT explode (the rule needs two-plus
  // arguments): `single(arr.map((x) => x))` stays inline.
  t.Run("single_composed_call_stays_inline", func(t *testing.T) {
    assertFormatUnchanged(t, "single(arr.map((x) => x));\n")
  })
  // A call argument with NO callback child does not trigger composition:
  // `nofn(plain.call(a, b), other)` stays inline.
  t.Run("call_arg_without_callback_stays_inline", func(t *testing.T) {
    assertFormatUnchanged(t, "nofn(plain.call(a, b), other);\n")
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
  // A decorator WITHOUT a huggable trailing argument is not exempt: two bare
  // arrows that overflow explode like any other composed call.
  t.Run("decorator_without_huggable_last_explodes", func(t *testing.T) {
    assertFormatUnchanged(t, `class D {
  @Validate(
    () => firstValidatorFunctionHere,
    () => secondValidatorFunctionHereLong,
  )
  field: string;
}
`)
  })
}
