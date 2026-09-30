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
//
// @evidence contracts/testing.md#behavioral-verification format/declaration-header must emit no finding for an overflowing exported interface heritage with exactly one generic argument.
// @evidence contracts/testing.md#independent-expectations The independently authored single-argument Base heritage has no argument list division to explode; the supported singleton-heritage convention leaves it inline even above width eighty.
// @evidence contracts/testing.md#distinguishing-cases This over-width one-argument negative complements the changed two-argument Serializer heritage explosion and the other one-argument long-base case.
// @evidence contracts/testing.md#execution-ownership TestFormatDeclarationHeaderKeepsSingleGenericHeritageArgInline is a public Go unit selected by TestSelectedLintUnits. The shared syntax-only fixture harness invokes the owning declaration-header rule and observes zero findings in the same Go process without consumer installation, a native product build or a product host.
func TestFormatDeclarationHeaderKeepsSingleGenericHeritageArgInline(t *testing.T) {
  assertRuleSkipsSourceWithOptions(
    t,
    "format/declaration-header",
    "export interface Foo extends Baseeeeeeeeeeeeeeeee<SomeVeryLongSingleTypeArgumentNameHere> {}\n",
    `{"printWidth":80,"tabWidth":2}`,
  )
}
