package linthost

import (
  "testing"
)

// TestUnicornPreventAbbreviationsExpandsCompoundAndCasedNamesButSkipsConstants verifies that the fixer compares all retained compound/Unicode/constant spellings with authored full source.
//
// The supported replacement dictionary and word/case policy independently expand Btn/err/cb while exempting all-uppercase constants.
//
// 1. Execute the retained binding, filename, option or command variants.
// 2. Compare the authored diagnostic, edit, helper value or preserved source.
//
// @evidence contracts/testing.md#behavioral-verification The fixer compares all retained compound/Unicode/constant spellings with authored full source.
// @evidence contracts/testing.md#independent-expectations The supported replacement dictionary and word/case policy independently expand Btn/err/cb while exempting all-uppercase constants.
// @evidence contracts/testing.md#distinguishing-cases BtnFactory, errCb and Unicode-suffixed err names change, while ENV remains unchanged.
// @evidence contracts/testing.md#execution-ownership TestUnicornPreventAbbreviationsExpandsCompoundAndCasedNamesButSkipsConstants owns its explicit variants and named subcases where present as a discoverable Go unit entry; actual checker/engine/fix/filename/casing operations run in the shared process with isolated fixture files and no installed consumer, native producer or product child host.
func TestUnicornPreventAbbreviationsExpandsCompoundAndCasedNamesButSkipsConstants(t *testing.T) {
  source := "class BtnFactory {}\nconst errCb = (): void => {};\nconst err文 = 1;\nconst errʰ = 2;\nconst ENV = \"test\";\nvoid [BtnFactory, errCb, err文, errʰ, ENV];\n"
  assertFixSnapshot(
    t,
    unicornPreventAbbreviationsRuleName,
    source,
    "class ButtonFactory {}\nconst errorCallback = (): void => {};\nconst error文 = 1;\nconst errorʰ = 2;\nconst ENV = \"test\";\nvoid [ButtonFactory, errorCallback, error文, errorʰ, ENV];\n",
  )
}
