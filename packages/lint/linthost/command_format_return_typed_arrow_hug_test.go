package linthost

import "testing"

// TestCommandFormatReturnTypedArrowHug preserves authored layouts for arrows
// with named-reference return types. An expression-bodied arrow returning a
// parenthesized object with `Location` is exploded; a block-bodied arrow with
// `PickItem` or `Location`, and an object-bodied arrow without a return type,
// remain hugged. The predicate rejects only type-reference annotations for
// object/array bodies, not every explicit return-type syntax.
//
// Each source is an independent authored fixed point at printWidth 80;
// no external formatter is invoked.
//
//  1. Seed five authored call layouts at width 80.
//  2. Run `ttsc format` with the default format block on each.
//  3. Require every file byte-identical.
//
// @evidence contracts/testing.md#behavioral-verification Five subcases run the in-process `format` command on authored call layouts and require each file unchanged: a return-typed expression-bodied object arrow exploded (as sole and trailing argument), the same arrow without a return type hugged, and block-bodied return-typed arrows hugged as last and first argument.
// @evidence contracts/testing.md#independent-expectations Complete authored sources are independent expected fixed points, preserving function/member names, return-type references, object members and their values; none is derived from formatter output or an external runtime oracle.
// @evidence contracts/testing.md#distinguishing-cases Pairs two object-body shapes with a named-reference return type against three hugging counterparts that differ by annotation or body kind. All are fixed points, so none shows a flat input being rewritten; keyword, union, array and literal return-type annotations are not covered.
// @evidence contracts/testing.md#execution-ownership In-process Go unit: each subcase calls run with the format subcommand on a temp-dir project via assertFormatUnchanged; no child process, built binary or installed consumer.
func TestCommandFormatReturnTypedArrowHug(t *testing.T) {
  // Return-typed arrow over a parenthesized object: explode (the core case).
  t.Run("return_typed_object_arrow_explodes", func(t *testing.T) {
    assertFormatUnchanged(t, `const b = references.map(
  (r): Location => ({
    uri: r.uri,
    range: r.range,
  }),
);
`)
  })
  // Same shape as a trailing argument behind a leading value: explode.
  t.Run("return_typed_object_arrow_trailing_explodes", func(t *testing.T) {
    assertFormatUnchanged(t, `const c = foo(
  x,
  (r): Location => ({
    uri: r.uri,
  }),
);
`)
  })
  // WITHOUT a return type the same arrow hugs.
  t.Run("untyped_object_arrow_hugs", func(t *testing.T) {
    assertFormatUnchanged(t, `const a = references.map((r) => ({
  uri: r.uri,
  range: r.range,
}));
`)
  })
  // A BLOCK-bodied arrow hugs even WITH a return type (the annotation only
  // declines the expression-body hug).
  t.Run("return_typed_block_arrow_hugs", func(t *testing.T) {
    assertFormatUnchanged(t, `const e = items.map((i): PickItem => {
  return {
    id: i.id,
    label: i.label,
    description: i.description,
    detailHere: i.x,
  };
});
`)
  })
  // A block-bodied return-typed arrow hugs in the first-argument position too.
  t.Run("return_typed_block_arrow_first_arg_hugs", func(t *testing.T) {
    assertFormatUnchanged(t, `const f = doThing((r): Location => {
  runTheCallbackBodyHereWithEnoughContentToOverflowEightyColumnsForSure(
    r.value,
  );
}, targetValue);
`)
  })
}
