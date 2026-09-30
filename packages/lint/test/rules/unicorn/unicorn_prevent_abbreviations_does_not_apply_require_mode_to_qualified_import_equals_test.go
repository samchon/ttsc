package linthost

import (
  "testing"
)

// TestUnicornPreventAbbreviationsDoesNotApplyRequireModeToQualifiedImportEquals verifies that actual fix execution compares qualified import-equals with its authored local alias rename.
//
// A qualified namespace alias is not an external require import, independently avoiding the disabled require-import exemption.
//
// 1. Execute the retained binding, filename, option or command variants.
// 2. Compare the authored diagnostic, edit, helper value or preserved source.
//
// @evidence contracts/testing.md#behavioral-verification Actual fix execution compares qualified import-equals with its authored local alias rename.
// @evidence contracts/testing.md#independent-expectations A qualified namespace alias is not an external require import, independently avoiding the disabled require-import exemption.
// @evidence contracts/testing.md#distinguishing-cases Source.err stays the qualified target while the local err alias/use become error.
// @evidence contracts/testing.md#execution-ownership TestUnicornPreventAbbreviationsDoesNotApplyRequireModeToQualifiedImportEquals owns its explicit variants and named subcases where present as a discoverable Go unit entry; actual checker/engine/fix/filename/casing operations run in the shared process with isolated fixture files and no installed consumer, native producer or product child host.
func TestUnicornPreventAbbreviationsDoesNotApplyRequireModeToQualifiedImportEquals(t *testing.T) {
  source := "namespace Source {\n  export const err = new Error();\n}\nimport err = Source.err;\nvoid err;\n"
  assertFixSnapshotWithOptions(
    t,
    unicornPreventAbbreviationsRuleName,
    source,
    `{"checkDefaultAndNamespaceImports":false}`,
    "namespace Source {\n  export const err = new Error();\n}\nimport error = Source.err;\nvoid error;\n",
  )
}
