package linthost

import (
  "testing"
)

// TestUnicornPreventAbbreviationsSeparatesGeneratedNamesInOneScope verifies that the fixer compares two same-scope candidates with the literal index/index_ output.
//
// Two lexical declarations cannot share a generated binding name; independent declaration order establishes the supported deterministic candidates.
//
// 1. Execute the retained binding, filename, option or command variants.
// 2. Compare the authored diagnostic, edit, helper value or preserved source.
//
// @evidence contracts/testing.md#behavioral-verification The fixer compares two same-scope candidates with the literal index/index_ output.
// @evidence contracts/testing.md#independent-expectations Two lexical declarations cannot share a generated binding name; independent declaration order establishes the supported deterministic candidates.
// @evidence contracts/testing.md#distinguishing-cases idx and i become index and index_, preserving both reads.
// @evidence contracts/testing.md#execution-ownership TestUnicornPreventAbbreviationsSeparatesGeneratedNamesInOneScope owns its explicit variants and named subcases where present as a discoverable Go unit entry; actual checker/engine/fix/filename/casing operations run in the shared process with isolated fixture files and no installed consumer, native producer or product child host.
func TestUnicornPreventAbbreviationsSeparatesGeneratedNamesInOneScope(t *testing.T) {
  source := "const idx = 0;\nconst i = 1;\nconsole.log(idx, i);\n"
  assertFixSnapshot(
    t,
    unicornPreventAbbreviationsRuleName,
    source,
    "const index = 0;\nconst index_ = 1;\nconsole.log(index, index_);\n",
  )
}
