package linthost

import "testing"

// TestCommandFormatReturnTypedArrowHug pins Prettier's couldGroupArg rule for
// arrow functions with an explicit return-type annotation: an EXPRESSION-bodied
// arrow returning a parenthesized object (`(r): T => ({ … })`) is NOT hugged,
// Prettier explodes the whole argument list to avoid breaking inside the
// composite return type. A BLOCK-bodied arrow still hugs regardless of the
// annotation, and an expression-bodied arrow WITHOUT a return type still hugs.
//
// Each source is the Prettier-canonical output at printWidth 80.
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
