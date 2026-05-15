package main

import "testing"

// TestFixNoWrapperObjectTypesReplacesTypename verifies the no-wrapper-object-types fixer.
//
// The fixer must rewrite the boxed wrapper type identifier in place (`String`
// → `string`) while leaving every surrounding token alone. ESLint omits the
// `Object` → `object` rewrite because the semantics shift meaningfully; the
// native fixer mirrors that policy by emitting a finding without an edit for
// `Object`, so this test pins only the primitive-wrapper subset.
//
// 1. Parse a source file with a `String`-typed annotation.
// 2. Apply the no-wrapper-object-types finding through the disk-backed fixer.
// 3. Assert only the type identifier changed.
func TestFixNoWrapperObjectTypesReplacesTypename(t *testing.T) {
  assertFixSnapshot(
    t,
    "no-wrapper-object-types",
    "let label: String = \"x\";\nJSON.stringify(label);\n",
    "let label: string = \"x\";\nJSON.stringify(label);\n",
  )
}
