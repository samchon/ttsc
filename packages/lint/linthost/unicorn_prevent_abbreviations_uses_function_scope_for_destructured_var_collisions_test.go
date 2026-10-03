package linthost

import (
  "testing"
)

// TestUnicornPreventAbbreviationsUsesFunctionScopeForDestructuredVarCollisions verifies that actual fix execution compares two destructured var renames with authored full source.
//
// Destructured var declarations share function scope, independently requiring index and index_ rather than duplicate names.
//
// @evidence contracts/testing.md#behavioral-verification Actual fix execution compares two destructured var renames with authored full source.
// @evidence contracts/testing.md#independent-expectations Destructured var declarations share function scope, independently requiring index and index_ rather than duplicate names.
// @evidence contracts/testing.md#distinguishing-cases Property keys first/second remain intact while idx/i bindings and their reads receive distinct candidates.
// @evidence contracts/testing.md#execution-ownership TestUnicornPreventAbbreviationsUsesFunctionScopeForDestructuredVarCollisions owns its explicit variants and named subcases where present as a discoverable Go unit entry; Checker-backed rule snapshots and actual disk fix application run in the shared Go process with isolated authored fixture files; no installed consumer, native producer or product child host runs.
func TestUnicornPreventAbbreviationsUsesFunctionScopeForDestructuredVarCollisions(t *testing.T) {
  source := "function read(source: Record<string, number>): void {\n  if (source.first) {\n    var { first: idx } = source;\n    console.log(idx);\n  }\n  if (source.second) {\n    var { second: i } = source;\n    console.log(i);\n  }\n}\nvoid read;\n"
  assertFixSnapshot(
    t,
    unicornPreventAbbreviationsRuleName,
    source,
    "function read(source: Record<string, number>): void {\n  if (source.first) {\n    var { first: index } = source;\n    console.log(index);\n  }\n  if (source.second) {\n    var { second: index_ } = source;\n    console.log(index_);\n  }\n}\nvoid read;\n",
  )
}
