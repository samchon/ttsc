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
//
// @evidence contracts/testing.md#behavioral-verification The wrapper-type rule changes String to string without touching label or its value.
// @evidence contracts/testing.md#independent-expectations Literal primitive annotation output follows the supported wrapper-to-primitive fix contract.
// @evidence contracts/testing.md#distinguishing-cases This owns String; it does not certify the meaning-changing Object rewrite, which the documented contract withholds.
// @evidence contracts/testing.md#execution-ownership TestFixNoWrapperObjectTypesReplacesTypename calls assertFixSnapshot for typescript/no-wrapper-object-types.
func TestFixNoWrapperObjectTypesReplacesTypename(t *testing.T) {
  assertFixSnapshot(
    t,
    "typescript/no-wrapper-object-types",
    "let label: String = \"x\";\nJSON.stringify(label);\n",
    "let label: string = \"x\";\nJSON.stringify(label);\n",
  )
}
