package linthost

import "testing"

// TestFormatDeclarationHeaderExplodesTypeParameters verifies an
// over-width type-parameter list explodes one parameter per line with a
// trailing comma and the `>` at the base indent, the heritage clause
// staying inline after `>`, matching Prettier 3 (the zod divergence).
//
//  1. Parse an interface whose `<...>` list overflows printWidth 50.
//  2. Apply format/declaration-header.
//  3. Assert the type params explode and `> extends Base<TKey> {` trails.
func TestFormatDeclarationHeaderExplodesTypeParameters(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/declaration-header",
    "interface D<TKey extends string, TValue extends object> extends Base<TKey> {\n  a: number;\n}\n",
    `{"printWidth":50,"tabWidth":2}`,
    "interface D<\n  TKey extends string,\n  TValue extends object,\n> extends Base<TKey> {\n  a: number;\n}\n",
  )
}
