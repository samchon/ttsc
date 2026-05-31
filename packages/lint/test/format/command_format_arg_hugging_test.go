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
  // first-arg hug with a TWO-argument trailing call: explode (Prettier hugs a
  // trailing call only when it has at most one value argument).
  t.Run("first_arg_two_arg_trailing_call_explodes", func(t *testing.T) {
    assertFormatUnchanged(t, `const b = array.reduce(
  (acc, item) => {
    acc.push(item);
    return acc;
  },
  someVeryLongFunctionCallNameHere(withArgumentOne, withArgumentTwoValue),
);
`)
  })
  // first-arg hug with a long ZERO-argument `new` (type args, long name): hug,
  // the close line is allowed to overflow because the new has no value args.
  t.Run("first_arg_long_zero_arg_new_hugs", func(t *testing.T) {
    assertFormatUnchanged(t, `const m = scopes.reduce((result, scope) => {
  result.set(scope[0], scope[1]);
  return result;
}, new Map<string, ConfigurationScope | undefined>());
`)
  })
  // first-arg hug with a long ONE-argument trailing call: hug despite the close
  // line overflowing (arg count, not length, gates the hug).
  t.Run("first_arg_long_one_arg_call_hugs", func(t *testing.T) {
    assertFormatUnchanged(t, `const d = arr.reduce((r, t) => {
  r[t] = t;
  return r;
}, makeInitialAccumulatorWithAReallyLongNameThatGoesOnAndOnAndOnPastEighty(single));
`)
  })
  // first-arg hug DECLINES when the trailing call's single argument is itself a
  // non-trivial call: Prettier's isSimpleCallArgument bottoms out at its depth
  // floor, so `makeInit(deriveSeed(config))` is not simple and the list
  // explodes. The positive twin above passes a plain identifier (`single`),
  // which stays simple and hugs. This pins the depth-bounded simplicity check.
  t.Run("first_arg_nested_call_trailing_explodes", func(t *testing.T) {
    assertFormatUnchanged(t, `const e = arr.reduce(
  (r, t) => {
    r[t] = t;
    return r;
  },
  makeInitialAccumulator(deriveSeedFromConfiguration(configurationObject)),
);
`)
  })
  // last-arg hug over an object-bodied arrow with a KEYWORD return type hugs:
  // Prettier's couldExpandArg declines only a TSTypeReference return type, so a
  // `void`/keyword return still hugs (a named-reference return would explode).
  t.Run("last_arg_keyword_return_object_arrow_hugs", func(t *testing.T) {
    assertFormatUnchanged(t, `const f = makeThing(config, (item): void => ({
  id: item.id,
  label: item.label,
  computedValueHere: item.value,
}));
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
  // first-arg hug declines over a CHAINED binary trailing arg (an operand is
  // itself a binary), even when short: explode (`60 * 60 * 1000`).
  t.Run("first_arg_chained_binary_trailing_explodes", func(t *testing.T) {
    assertFormatUnchanged(t, `const t = new ProcessTimeRunOnceScheduler(
  () => {
    this.run();
  },
  60 * 60 * 1000,
);
`)
  })
  // first-arg hug over a single-operation binary still hugs (`60 * 1000`).
  t.Run("first_arg_single_binary_trailing_hugs", func(t *testing.T) {
    assertFormatUnchanged(t, `const s = new RunOnceScheduler(() => {
  this.run();
}, 60 * 1000);
`)
  })
  // first-arg hug over a cast to a SIMPLE type hugs (`[] as Array<string>`).
  t.Run("first_arg_simple_cast_trailing_hugs", func(t *testing.T) {
    assertFormatUnchanged(t, `const u = arr.reduce((r, x) => {
  r.push(x);
  return r;
}, [] as Array<string>);
`)
  })
  // first-arg hug DECLINES over a cast wrapping a NON-EMPTY array
  // (`[seed] as ReadonlyArray<string>`): the cast TYPE is simple, but Prettier's
  // couldExpandArg treats a non-empty array as expandable, so the list explodes
  // instead of hugging. The empty-array positive twin above stays simple and hugs;
  // this pins the expression half of the cast predicate.
  t.Run("first_arg_nonempty_array_cast_trailing_explodes", func(t *testing.T) {
    assertFormatUnchanged(t, `const w = Object.keys(contrib).reduce(
  (result, location) => {
    result.push(location);
    return result;
  },
  [seed] as ReadonlyArray<string>,
);
`)
  })
  // first-arg hug declines over a cast to a type carrying an object literal:
  // explode (`[] as Array<{ … }>`).
  t.Run("first_arg_object_type_cast_trailing_explodes", func(t *testing.T) {
    assertFormatUnchanged(t, `const v = Object.keys(contrib).reduce(
  (result, location) => {
    result.push(location);
    return result;
  },
  [] as Array<{ id: string; name: string; location: string }>,
);
`)
  })
  // A cast to a reference with TWO type arguments is not simple (Prettier's
  // isSimpleType only accepts a reference with no args, and the cast branch
  // unwraps just a single arg): explode.
  t.Run("first_arg_multi_type_arg_cast_explodes", func(t *testing.T) {
    assertFormatUnchanged(t, `const w = Object.keys(contrib).reduce(
  (result, location) => {
    result.push(location);
    return result;
  },
  [] as Foo<AlphaTypeName, BetaTypeName>,
);
`)
  })
  // A nested-generic cast (`Array<Array<string>>`) unwraps one level to
  // `Array<string>`, which still carries an argument, so it is not simple:
  // explode.
  t.Run("first_arg_nested_generic_cast_explodes", func(t *testing.T) {
    assertFormatUnchanged(t, `const n = Object.keys(contrib).reduce(
  (result, location) => {
    result.push(location);
    return result;
  },
  [] as Array<Array<StringTypeNameHere>>,
);
`)
  })
  // A cast to a union type is not simple: explode.
  t.Run("first_arg_union_cast_explodes", func(t *testing.T) {
    assertFormatUnchanged(t, `const u2 = Object.keys(contrib).reduce(
  (result, location) => {
    result.push(location);
    return result;
  },
  init as AlphaUnionMemberType | BetaUnionMemberType,
);
`)
  })
  // The positive twin: a SINGLE-type-argument reference unwraps to a bare
  // reference (`Foo<Bar>` -> `Bar`), which is simple, so the first arg hugs.
  t.Run("first_arg_single_type_arg_cast_hugs", func(t *testing.T) {
    assertFormatUnchanged(t, `const s2 = arr.reduce((r, x) => {
  r.push(x);
  return r;
}, init as Foo<BarTypeArgumentName>);
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
