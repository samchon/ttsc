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
func TestFixNoWrapperObjectTypesReplacesUnshadowedConst(t *testing.T) {
  assertFixSnapshot(
    t,
    "typescript/no-wrapper-object-types",
    "const x: String = \"a\" as any;\nJSON.stringify(x);\n",
    "const x: string = \"a\" as any;\nJSON.stringify(x);\n",
  )
}
