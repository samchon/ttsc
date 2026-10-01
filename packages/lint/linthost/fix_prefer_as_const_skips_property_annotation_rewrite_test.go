package linthost

import "testing"

// TestFixPreferAsConstSkipsPropertyAnnotationRewrite verifies preferAsConst reports property annotations without edits.
//
// Class property annotations follow the same suggestion-only upstream
// contract as variable annotations: the declaration keeps its modifiers and
// annotation untouched under `ttsc fix`, while the manual suggestion remains
// available to editors. A Finding.Fix edit here would let the fix cascade
// silently rewrite class shapes.
//
// 1. Parse a class with `public value: "literal" = "literal";`.
// 2. Run preferAsConst and apply any offered text edits.
// 3. Assert a finding exists and the source remains unchanged.
//
// @evidence contracts/testing.md#behavioral-verification prefer-as-const reports the class property literal annotation but applies no automatic edits.
// @evidence contracts/testing.md#independent-expectations The original complete class source and zero edits preserve modifiers and declaration shape; the exact manual suggestion is pinned separately.
// @evidence contracts/testing.md#distinguishing-cases A property annotation is suggestion-only, contrasting with automatic expression assertion rewriting.
// @evidence contracts/testing.md#execution-ownership TestFixPreferAsConstSkipsPropertyAnnotationRewrite invokes assertNoFixSnapshot on Holder.value.
func TestFixPreferAsConstSkipsPropertyAnnotationRewrite(t *testing.T) {
  assertNoFixSnapshot(
    t,
    "typescript/prefer-as-const",
    "class Holder {\n  public value: \"literal\" = \"literal\";\n}\nJSON.stringify(new Holder());\n",
  )
}
