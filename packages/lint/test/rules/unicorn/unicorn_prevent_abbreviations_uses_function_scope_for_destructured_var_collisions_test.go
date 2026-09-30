package linthost

import (
  "testing"
)

// TestUnicornPreventAbbreviationsUsesFunctionScopeForDestructuredVarCollisions verifies that actual fix execution compares two destructured var renames with authored full source.
//
// Destructured var declarations share function scope, independently requiring index and index_ rather than duplicate names.
//
// 1. Execute the retained binding, filename, option or command variants.
// 2. Compare the authored diagnostic, edit, helper value or preserved source.
//
// @evidence contracts/testing.md#behavioral-verification Actual fix execution compares two destructured var renames with authored full source.
// @evidence contracts/testing.md#independent-expectations Destructured var declarations share function scope, independently requiring index and index_ rather than duplicate names.
// @evidence contracts/testing.md#distinguishing-cases Property keys first/second remain intact while idx/i bindings and their reads receive distinct candidates.
// @evidence contracts/testing.md#execution-ownership TestUnicornPreventAbbreviationsUsesFunctionScopeForDestructuredVarCollisions owns its explicit variants and named subcases where present as a discoverable Go unit entry; actual checker/engine/fix/filename/casing operations run in the shared process with isolated fixture files and no installed consumer, native producer or product child host.
func TestUnicornPreventAbbreviationsUsesFunctionScopeForDestructuredVarCollisions(t *testing.T) {
  source := "function read(source: Record<string, number>): void {\n  if (source.first) {\n    var { first: idx } = source;\n    console.log(idx);\n  }\n  if (source.second) {\n    var { second: i } = source;\n    console.log(i);\n  }\n}\nvoid read;\n"
  assertFixSnapshot(
    t,
    unicornPreventAbbreviationsRuleName,
    source,
    "function read(source: Record<string, number>): void {\n  if (source.first) {\n    var { first: index } = source;\n    console.log(index);\n  }\n  if (source.second) {\n    var { second: index_ } = source;\n    console.log(index_);\n  }\n}\nvoid read;\n",
  )
}
