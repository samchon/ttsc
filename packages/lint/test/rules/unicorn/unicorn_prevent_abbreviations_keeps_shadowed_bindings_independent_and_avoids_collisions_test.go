package linthost

import (
  "testing"
)

// TestUnicornPreventAbbreviationsKeepsShadowedBindingsIndependentAndAvoidsCollisions verifies that the fixer compares separate lexical bindings with an authored whole-source output.
//
// An existing error binding independently requires error_ only in its scope; the sibling scope can use error.
//
// @evidence contracts/testing.md#behavioral-verification The fixer compares separate lexical bindings with an authored whole-source output.
// @evidence contracts/testing.md#independent-expectations An existing error binding independently requires error_ only in its scope; the sibling scope can use error.
// @evidence contracts/testing.md#distinguishing-cases The outer collision and clean sibling rename retain distinct suffix decisions.
// @evidence contracts/testing.md#execution-ownership TestUnicornPreventAbbreviationsKeepsShadowedBindingsIndependentAndAvoidsCollisions owns its explicit variants and named subcases where present as a discoverable Go unit entry; Checker-backed rule snapshots and actual disk fix application run in the shared Go process with isolated authored fixture files; no installed consumer, native producer or product child host runs.
func TestUnicornPreventAbbreviationsKeepsShadowedBindingsIndependentAndAvoidsCollisions(t *testing.T) {
  source := "function outer(err: string) {\n  const error = \"kept\";\n  return err + error;\n}\nfunction sibling(err: string) {\n  return err;\n}\nvoid [outer, sibling];\n"
  assertFixSnapshot(
    t,
    unicornPreventAbbreviationsRuleName,
    source,
    "function outer(error_: string) {\n  const error = \"kept\";\n  return error_ + error;\n}\nfunction sibling(error: string) {\n  return error;\n}\nvoid [outer, sibling];\n",
  )
}
