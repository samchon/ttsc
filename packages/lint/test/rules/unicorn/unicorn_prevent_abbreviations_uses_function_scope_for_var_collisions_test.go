package linthost

import (
  "testing"
)

// TestUnicornPreventAbbreviationsUsesFunctionScopeForVarCollisions verifies that the fixer checks authored renamed var bindings across separate conditional blocks.
//
// var is function-scoped independently of its block placement, so the retained error var collides with generated error.
//
// 1. Execute the retained binding, filename, option or command variants.
// 2. Compare the authored diagnostic, edit, helper value or preserved source.
//
// @evidence contracts/testing.md#behavioral-verification The fixer checks authored renamed var bindings across separate conditional blocks.
// @evidence contracts/testing.md#independent-expectations var is function-scoped independently of its block placement, so the retained error var collides with generated error.
// @evidence contracts/testing.md#distinguishing-cases err becomes error_ across its declaration/read while the existing error spelling stays intact.
// @evidence contracts/testing.md#execution-ownership TestUnicornPreventAbbreviationsUsesFunctionScopeForVarCollisions owns its explicit variants and named subcases where present as a discoverable Go unit entry; actual checker/engine/fix/filename/casing operations run in the shared process with isolated fixture files and no installed consumer, native producer or product child host.
func TestUnicornPreventAbbreviationsUsesFunctionScopeForVarCollisions(t *testing.T) {
  source := "function render(condition: boolean): string {\n  if (condition) {\n    var err = \"first\";\n  }\n  if (!condition) {\n    var error = \"second\";\n  }\n  return err + error;\n}\nvoid render;\n"
  assertFixSnapshot(
    t,
    unicornPreventAbbreviationsRuleName,
    source,
    "function render(condition: boolean): string {\n  if (condition) {\n    var error_ = \"first\";\n  }\n  if (!condition) {\n    var error = \"second\";\n  }\n  return error_ + error;\n}\nvoid render;\n",
  )
}
