package linthost

import "testing"

// TestFixPreferAsConstSkipsPropertyAnnotationRewrite verifies preferAsConst reports property annotations without edits.
//
// Class property annotations follow the same suggestion-only upstream
// contract as variable annotations: the declaration keeps its modifiers and
// annotation untouched under `ttsc fix`, and only the diagnostic surfaces.
// A TextEdit here would let the fix cascade silently rewrite class shapes.
//
// 1. Parse a class with `public value: "literal" = "literal";`.
// 2. Run preferAsConst and apply any offered text edits.
// 3. Assert a finding exists and the source remains unchanged.
func TestFixPreferAsConstSkipsPropertyAnnotationRewrite(t *testing.T) {
  assertNoFixSnapshot(
    t,
    "typescript/prefer-as-const",
    "class Holder {\n  public value: \"literal\" = \"literal\";\n}\nJSON.stringify(new Holder());\n",
  )
}
