package linthost

import (
  "testing"
)

// TestUnicornPreventAbbreviationsKeepsMappedAndConditionalTypeScopesIndependent verifies that the fixer checks authored conditional infer and mapped type variable renames.
//
// Separate TypeScript infer/mapped scopes independently permit Context reuse without capture.
//
// 1. Execute the retained binding, filename, option or command variants.
// 2. Compare the authored diagnostic, edit, helper value or preserved source.
//
// @evidence contracts/testing.md#behavioral-verification The fixer checks authored conditional infer and mapped type variable renames.
// @evidence contracts/testing.md#independent-expectations Separate TypeScript infer/mapped scopes independently permit Context reuse without capture.
// @evidence contracts/testing.md#distinguishing-cases Two conditional and two mapped Ctx variables retain separate Context replacements and references.
// @evidence contracts/testing.md#execution-ownership TestUnicornPreventAbbreviationsKeepsMappedAndConditionalTypeScopesIndependent owns its explicit variants and named subcases where present as a discoverable Go unit entry; actual checker/engine/fix/filename/casing operations run in the shared process with isolated fixture files and no installed consumer, native producer or product child host.
func TestUnicornPreventAbbreviationsKeepsMappedAndConditionalTypeScopesIndependent(t *testing.T) {
  source := "type Pair<T, U> = [\n  T extends infer Ctx ? Ctx : never,\n  U extends infer Ctx ? Ctx : never,\n  { [Ctx in keyof T]: T[Ctx] },\n  { [Ctx in keyof U]: U[Ctx] },\n];\n"
  assertFixSnapshot(
    t,
    unicornPreventAbbreviationsRuleName,
    source,
    "type Pair<T, U> = [\n  T extends infer Context ? Context : never,\n  U extends infer Context ? Context : never,\n  { [Context in keyof T]: T[Context] },\n  { [Context in keyof U]: U[Context] },\n];\n",
  )
}
