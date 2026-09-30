package linthost

import "testing"

// TestFormatDeclarationHeaderKeepsSingleHeritageTypeInline verifies a
// lone `extends X<Y>` with one argument remains inline even when it overflows.
//
// Prettier keeps a single heritage type inline (it has nothing to break
// into a list), so the rule must abstain rather than invent a break.
//
//  1. Parse an interface with one long extends type (printWidth 50).
//  2. Run format/declaration-header.
//  3. Assert the rule reports nothing.
//
// @evidence contracts/testing.md#behavioral-verification format/declaration-header must emit no finding for an overflowing lone heritage type with one type argument rather than inventing a type-list break.
// @evidence contracts/testing.md#independent-expectations The single SomeReallyLongBaseInterfaceName<WithArgs> fixture has no multi-argument list to explode; its unchanged-header layout follows the one-argument heritage convention.
// @evidence contracts/testing.md#distinguishing-cases The overflowing one-argument negative complements the actual two-argument Serializer heritage explosion and multiple-type clause positives.
// @evidence contracts/testing.md#execution-ownership TestFormatDeclarationHeaderKeepsSingleHeritageTypeInline is selected by TestSelectedLintUnits as a public Go unit. The shared syntax-only harness calls the owning declaration-header rule on temporary fixture source and observes zero findings without consumer installation, native product build or a host process.
func TestFormatDeclarationHeaderKeepsSingleHeritageTypeInline(t *testing.T) {
  assertRuleSkipsSourceWithOptions(
    t,
    "format/declaration-header",
    "interface A extends SomeReallyLongBaseInterfaceName<WithArgs> {\n  a: number;\n}\n",
    `{"printWidth":50,"tabWidth":2}`,
  )
}
