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
