package linthost

import "testing"

// TestFormatTrailingCommaInsertsAfterParameterPropertyInConstructor verifies
// the rule fires correctly when the last constructor parameter is a
// private TypeScript parameter property, following a public readonly property.
//
// Stacked parameter-property modifiers do not alter the final parameter comma policy. The edit must follow the complete final declaration and preserve every modifier.
//
//  1. Parse a source file with one class whose constructor declares two
//     multi-line parameter properties with mixed modifiers.
//  2. Apply the rule's finding through the disk-backed fixer.
//  3. Assert the rewritten file contains the trailing comma after the
//     last parameter property.
//
// @evidence contracts/testing.md#behavioral-verification The constructor must gain a comma after private y:number while retaining public readonly x:number and every class/body token.
// @evidence contracts/testing.md#independent-expectations Prettier all-mode permits terminal constructor-parameter commas. The literal output independently preserves both modifiers, field names and parameter types.
// @evidence contracts/testing.md#distinguishing-cases The first property has stacked public/readonly modifiers and the final property is private, unlike the simple public/public constructor peer. The constructor ES5 host supplies mode exclusion.
// @evidence contracts/testing.md#execution-ownership TestFormatTrailingCommaInsertsAfterParameterPropertyInConstructor owns its authored literal source and complete expected edit output in the public Go unit population. The syntax-only owning rule and edit application execute in one Go process without consumer installation, native artifact building or product-host children.
func TestFormatTrailingCommaInsertsAfterParameterPropertyInConstructor(t *testing.T) {
  assertFixSnapshot(
    t,
    "format/trailing-comma",
    "class Point {\n  constructor(\n    public readonly x: number,\n    private y: number\n  ) {}\n}\nPoint;\n",
    "class Point {\n  constructor(\n    public readonly x: number,\n    private y: number,\n  ) {}\n}\nPoint;\n",
  )
}
