package linthost

import "testing"

// TestFixNoWrapperObjectTypesSkipsFunctionShadow verifies the shadow
// bailout also covers a file-scope `function String() {}` declaration.
//
// Before this repair the shadow guard skipped KindFunctionDeclaration, so a
// local `function String() {}` left the binding invisible: the rule fired on
// the `String` reference and the fix rewrote `const x: String` to the global
// `string` primitive — silently retargeting the annotation to a different
// type. The repair adds KindFunctionDeclaration to the guard so the rule
// bails to detection-only when a same-named function binding is present.
//
//  1. Parse a file that declares `function String()` and annotates with it.
//  2. Run the rule under the engine and confirm zero findings.
//  3. The shadowed `String` annotation survives byte-for-byte.
func TestFixNoWrapperObjectTypesSkipsFunctionShadow(t *testing.T) {
  assertRuleSkipsSource(
    t,
    "typescript/no-wrapper-object-types",
    "function String() {}\nconst x: String = new (String as any)();\nJSON.stringify(x);\n",
  )
}
