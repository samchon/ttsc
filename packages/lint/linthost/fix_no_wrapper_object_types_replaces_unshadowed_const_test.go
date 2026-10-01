package linthost

import "testing"

// TestFixNoWrapperObjectTypesReplacesUnshadowedConst verifies the
// comprehensive shadow guard does not over-suppress: a genuine global
// `String` annotation, with NO same-named binding anywhere in the file, must
// still rewrite to the `string` primitive.
//
// The broadened guard now bails on any file-scope binding (function,
// import-equals, namespace, etc.). This case proves the rule still fires when
// none of those bindings exist, so the broadening did not silence the rule
// outright.
//
//  1. Parse a file whose only `String` use is a global type annotation.
//  2. Apply the noWrapperObjectTypes finding through the disk-backed fixer.
//  3. Assert the annotation rewrote to lowercase `string`.
//
// @evidence contracts/testing.md#behavioral-verification The wrapper-type rule fixes the genuine unshadowed global String annotation.
// @evidence contracts/testing.md#independent-expectations Literal const x: string preserves the initializer and use while asserting the primitive replacement independently.
// @evidence contracts/testing.md#distinguishing-cases No local String declaration exists; the function, import and type-alias shadow cases must stay silent.
// @evidence contracts/testing.md#execution-ownership TestFixNoWrapperObjectTypesReplacesUnshadowedConst runs assertFixSnapshot on the unshadowed x fixture.
func TestFixNoWrapperObjectTypesReplacesUnshadowedConst(t *testing.T) {
  assertFixSnapshot(
    t,
    "typescript/no-wrapper-object-types",
    "const x: String = \"a\" as any;\nJSON.stringify(x);\n",
    "const x: string = \"a\" as any;\nJSON.stringify(x);\n",
  )
}
