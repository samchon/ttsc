package linthost

import (
  "testing"
)

// TestUnicornPreventAbbreviationsRenamesClassInnerAndOuterReferencesTogether verifies that the real fixer compares class declaration, inner type/new uses and outer read with a literal output.
//
// The class inner and outer identities jointly name the same declaration, independently requiring consistent error spelling.
//
// 1. Execute the retained binding, filename, option or command variants.
// 2. Compare the authored diagnostic, edit, helper value or preserved source.
//
// @evidence contracts/testing.md#behavioral-verification The real fixer compares class declaration, inner type/new uses and outer read with a literal output.
// @evidence contracts/testing.md#independent-expectations The class inner and outer identities jointly name the same declaration, independently requiring consistent error spelling.
// @evidence contracts/testing.md#distinguishing-cases Class name, static return type, constructor call and outer read all change together.
// @evidence contracts/testing.md#execution-ownership TestUnicornPreventAbbreviationsRenamesClassInnerAndOuterReferencesTogether owns its explicit variants and named subcases where present as a discoverable Go unit entry; actual checker/engine/fix/filename/casing operations run in the shared process with isolated fixture files and no installed consumer, native producer or product child host.
func TestUnicornPreventAbbreviationsRenamesClassInnerAndOuterReferencesTogether(t *testing.T) {
  source := "class err {\n  static create(): err {\n    return new err();\n  }\n}\nvoid err;\n"
  assertFixSnapshot(
    t,
    unicornPreventAbbreviationsRuleName,
    source,
    "class error {\n  static create(): error {\n    return new error();\n  }\n}\nvoid error;\n",
  )
}
