package linthost

import "testing"

// TestFixNoWrapperObjectTypesSkipsImportEqualsShadow verifies the shadow
// bailout also covers an `import String = require(...)` binding.
//
// Before this repair the shadow guard skipped KindImportEqualsDeclaration, so
// an `import String = require("./m")` left the binding invisible: the rule
// fired on the `String` reference and the fix rewrote `const x: String` to the
// global `string` primitive — silently retargeting the annotation to a
// different type. The repair adds KindImportEqualsDeclaration to the guard so
// the rule bails to detection-only when a same-named import-equals binding is
// present.
//
//  1. Parse a file that does `import String = require("./m")` and annotates.
//  2. Run the rule under the engine and confirm zero findings.
//  3. The shadowed `String` annotation survives byte-for-byte.
func TestFixNoWrapperObjectTypesSkipsImportEqualsShadow(t *testing.T) {
  assertRuleSkipsSource(
    t,
    "typescript/no-wrapper-object-types",
    "import String = require(\"./m\");\nconst x: String = \"\" as unknown as String;\nJSON.stringify(x);\n",
  )
}
