package linthost

import (
  "testing"
)

// TestUnicornPreventAbbreviationsAvoidsVarLexicalEarlyErrorCollisions verifies that the real fixer checks the complete authored block/loop/catch collision output.
//
// JavaScript var-versus-lexical early-error restrictions independently require suffixes when scopes overlap despite nested syntax.
//
// 1. Execute the retained binding, filename, option or command variants.
// 2. Compare the authored diagnostic, edit, helper value or preserved source.
//
// @evidence contracts/testing.md#behavioral-verification The real fixer checks the complete authored block/loop/catch collision output.
// @evidence contracts/testing.md#independent-expectations JavaScript var-versus-lexical early-error restrictions independently require suffixes when scopes overlap despite nested syntax.
// @evidence contracts/testing.md#distinguishing-cases Block current, loop index and catch function_ candidates each retain their distinct conflicting-var suffix.
// @evidence contracts/testing.md#execution-ownership TestUnicornPreventAbbreviationsAvoidsVarLexicalEarlyErrorCollisions owns its explicit variants and named subcases where present as a discoverable Go unit entry; actual checker/engine/fix/filename/casing operations run in the shared process with isolated fixture files and no installed consumer, native producer or product child host.
func TestUnicornPreventAbbreviationsAvoidsVarLexicalEarlyErrorCollisions(t *testing.T) {
  source := "function check(values: number[]): void {\n  {\n    const cur = 0;\n    if (cur === 0) {\n      var curr = 1;\n      console.log(curr);\n    }\n  }\n  for (const idx of values) {\n    if (values.length > 0) {\n      var i = 1;\n      console.log(i);\n    }\n  }\n  try {\n    throw { value: 0 };\n  } catch ({ value: fn }) {\n    if (values.length > 0) {\n      var func = 1;\n      console.log(func);\n    }\n  }\n}\nvoid check;\n"
  assertFixSnapshot(
    t,
    unicornPreventAbbreviationsRuleName,
    source,
    "function check(values: number[]): void {\n  {\n    const current = 0;\n    if (current === 0) {\n      var current_ = 1;\n      console.log(current_);\n    }\n  }\n  for (const index of values) {\n    if (values.length > 0) {\n      var index_ = 1;\n      console.log(index_);\n    }\n  }\n  try {\n    throw { value: 0 };\n  } catch ({ value: function_ }) {\n    if (values.length > 0) {\n      var function__ = 1;\n      console.log(function__);\n    }\n  }\n}\nvoid check;\n",
  )
}
