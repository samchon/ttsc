package linthost

import "testing"

// TestFormatDeclarationHeaderKeepsSingleGenericHeritageArgInline verifies a
// heritage type with a single type argument is left inline even when it
// overflows, matching Prettier 3.8.3 (it breaks a heritage type-argument
// list only when there are two or more arguments).
//
//  1. Parse an interface extending one generic type with one long argument.
//  2. Run format/declaration-header.
//  3. Assert the rule reports nothing (kept inline).
func TestFormatDeclarationHeaderKeepsSingleGenericHeritageArgInline(t *testing.T) {
  assertRuleSkipsSourceWithOptions(
    t,
    "format/declaration-header",
    "export interface Foo extends Baseeeeeeeeeeeeeeeee<SomeVeryLongSingleTypeArgumentNameHere> {}\n",
    `{"printWidth":80,"tabWidth":2}`,
  )
}
