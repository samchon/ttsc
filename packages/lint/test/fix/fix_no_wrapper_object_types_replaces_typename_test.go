package linthost

import "testing"

// TestFixNoWrapperObjectTypesReplacesTypename verifies the noWrapperObjectTypes fixer.
//
// The fixer must rewrite the boxed wrapper type identifier in place (`String`
// → `string`) while leaving every surrounding token alone. ESLint omits the
// `Object` → `object` rewrite because the semantics shift meaningfully; the
// native fixer mirrors that policy by emitting a finding without an edit for
// `Object`, so this test pins only the primitive-wrapper subset.
//
// 1. Parse a source file with a `String`-typed annotation.
// 2. Apply the noWrapperObjectTypes finding through the disk-backed fixer.
// 3. Assert only the type identifier changed.
func TestFixNoWrapperObjectTypesReplacesTypename(t *testing.T) {
  assertFixSnapshot(
    t,
    "noWrapperObjectTypes",
    "let label: String = \"x\";\nJSON.stringify(label);\n",
    "let label: string = \"x\";\nJSON.stringify(label);\n",
  )
}
