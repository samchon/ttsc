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
//
// @evidence contracts/testing.md#behavioral-verification format/declaration-header must split the oversized two constrained type parameters with a trailing comma, then keep extends Base<TKey> after the closing angle bracket and preserve a:number.
// @evidence contracts/testing.md#independent-expectations The independently authored output literal specifies the generic declaration layout at width fifty and retains both constraints plus the heritage argument and body.
// @evidence contracts/testing.md#distinguishing-cases The changed generic singleton-heritage case complements generic-plus-multiple-clause abstention and generic heritage argument explosion; exact bytes prove rewrite and retained type meaning.
// @evidence contracts/testing.md#execution-ownership TestFormatDeclarationHeaderExplodesTypeParameters is a public Go unit selected by TestSelectedLintUnits. Its shared syntax-only harness invokes the owning formatter on temporary fixture source and applies its reported edits for exact output assertions in the same process, without a consumer install, native product build or host execution.
func TestFormatDeclarationHeaderExplodesTypeParameters(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/declaration-header",
    "interface D<TKey extends string, TValue extends object> extends Base<TKey> {\n  a: number;\n}\n",
    `{"printWidth":50,"tabWidth":2}`,
    "interface D<\n  TKey extends string,\n  TValue extends object,\n> extends Base<TKey> {\n  a: number;\n}\n",
  )
}
