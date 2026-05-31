package linthost

import "testing"

// TestCommandFormatArgHugging pins Prettier 3's call-argument hugging against
// ttsc. Each source is the Prettier-canonical output at printWidth 80, so
// format must keep it byte-identical. The cases probe the boundary: a clean
// last-arg hug, a first-arg hug, and two shapes Prettier does NOT hug (it
// explodes) because more than one argument is complex.
func TestCommandFormatArgHugging(t *testing.T) {
  // last-arg block arrow, sole complex arg: hug.
  t.Run("last_arg_arrow_block_hugs", func(t *testing.T) {
    assertFormatUnchanged(t, `register("compile", async (ctx) => {
  await ctx.run();
});
`)
  })
  // first arg block arrow + simple trailing: first-arg hug.
  t.Run("first_arg_arrow_block_hugs", func(t *testing.T) {
    assertFormatUnchanged(t, `const r = items.reduce((acc, x) => {
  acc.push(x);
  return acc;
}, [] as string[]);
`)
  })
  // first-arg hug with a SHORT trailing call (`Object.create(null)`): hug.
  t.Run("first_arg_short_trailing_call_hugs", func(t *testing.T) {
    assertFormatUnchanged(t, `const a = array.reduce((r, t) => {
  r[t] = t;
  return r;
}, Object.create(null));
`)
  })
  // first-arg hug with a LONG trailing call: explode (the close line would
  // overflow).
  t.Run("first_arg_long_trailing_call_explodes", func(t *testing.T) {
    assertFormatUnchanged(t, `const b = array.reduce(
  (acc, item) => {
    acc.push(item);
    return acc;
  },
  someVeryLongFunctionCallNameHere(withArgumentOne, withArgumentTwoValue),
);
`)
  })
  // first-arg hug over a short binary trailing arg (`1000 - ellapsed`): hug.
  t.Run("first_arg_short_binary_trailing_hugs", func(t *testing.T) {
    assertFormatUnchanged(t, `setTimeout(() => {
  this.checkCallbacks();
}, 1000 - ellapsed);
`)
  })
  // first-arg hug over a short arithmetic trailing arg (`30 * 1000`): hug.
  t.Run("first_arg_arithmetic_trailing_hugs", func(t *testing.T) {
    assertFormatUnchanged(t, `const s = new RunOnceScheduler(() => {
  this.cleanUpCodeCaches(currentCodeCachePath);
}, 30 * 1000);
`)
  })
  // first-arg hug over an EMPTY object trailing arg (`{}`): hug.
  t.Run("first_arg_empty_object_trailing_hugs", func(t *testing.T) {
    assertFormatUnchanged(t, `const set = preserve.reduce((set, key) => {
  set[key] = true;
  return set;
}, {});
`)
  })
  // first-arg hug over a prefix-unary trailing arg (`-1`): hug.
  t.Run("first_arg_prefix_unary_trailing_hugs", func(t *testing.T) {
    assertFormatUnchanged(t, `const r = items.reduce((acc, x) => {
  acc.push(x);
  return acc;
}, -1);
`)
  })
  // first-arg hug declines over a NON-empty object trailing arg: explode.
  t.Run("first_arg_nonempty_object_trailing_explodes", func(t *testing.T) {
    assertFormatUnchanged(t, `f3(
  () => {
    b();
  },
  { a: 1 },
);
`)
  })
  // first-arg hug declines over a long binary trailing arg (the hugged close
  // line would overflow): explode.
  t.Run("first_arg_long_binary_trailing_explodes", func(t *testing.T) {
    assertFormatUnchanged(t, `f5(
  () => {
    b();
  },
  aaa + bbb + ccc + ddd + eee + fff + ggg + hhh + iii + jjj + kkk,
);
`)
  })
  // two arrows then an object: Prettier explodes (more than one complex arg).
  t.Run("two_arrows_then_object_explodes", func(t *testing.T) {
    assertFormatUnchanged(t, `manyToOne(
  () => Category,
  (category) => category.posts,
  { cascade: ["insert"], eager: true },
);
`)
  })
  // simple, object, object: Prettier explodes (penultimate also an object).
  t.Run("simple_object_object_explodes", func(t *testing.T) {
    assertFormatUnchanged(t, `const s = new Sash(
  this.domNode,
  { getVerticalSashLeft: () => 0 },
  { orientation: vertical },
);
`)
  })
  // two simple args then an object: penultimate simple, so hug the object.
  t.Run("simple_simple_object_hugs", func(t *testing.T) {
    assertFormatUnchanged(t, `foo(simpleA, simpleBValue, {
  lastObjectPropertyHere: trueValueGoesHereToBreak,
});
`)
  })
  // object then object (two args): penultimate object, so explode.
  t.Run("object_then_object_explodes", func(t *testing.T) {
    assertFormatUnchanged(t, `bar(
  { firstObjectValue: 1 },
  { lastObjectPropertyHere: trueValueGoesHereToBreak },
);
`)
  })
  // a DECORATOR hugs its last object past two leading arrows (the typeorm
  // @OneToMany shape); the plain-call counterpart (two_arrows_then_object)
  // explodes.
  t.Run("decorator_hugs_object_past_two_arrows", func(t *testing.T) {
    assertFormatUnchanged(t, `class C {
  @OneToMany(() => Post, (post) => post.category, {
    cascade: ["insert"],
  })
  posts: Post[];
}
`)
  })
}
