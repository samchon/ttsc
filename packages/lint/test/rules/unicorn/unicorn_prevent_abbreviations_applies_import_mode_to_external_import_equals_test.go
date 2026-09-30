package linthost

import (
  "testing"
)

// TestUnicornPreventAbbreviationsAppliesImportModeToExternalImportEquals verifies that the fixer checks the relative require-based import-equals rename and the disabled-mode clean counterpart.
//
// TypeScript external-module-reference syntax (import alias = require(...)) follows the default/namespace import control; this fixture uses the relative module ./local, not an external package.
//
// 1. Execute the retained binding, filename, option or command variants.
// 2. Compare the authored diagnostic, edit, helper value or preserved source.
//
// @evidence contracts/testing.md#behavioral-verification The fixer checks the relative require-based import-equals rename and the disabled-mode clean counterpart.
// @evidence contracts/testing.md#independent-expectations TypeScript external-module-reference syntax (import alias = require(...)) follows the default/namespace import control; this fixture uses the relative module ./local, not an external package.
// @evidence contracts/testing.md#distinguishing-cases Internal require alias changes by default but remains clean when its import checking is disabled.
// @evidence contracts/testing.md#execution-ownership TestUnicornPreventAbbreviationsAppliesImportModeToExternalImportEquals owns its explicit variants and named subcases where present as a discoverable Go unit entry; actual checker/engine/fix/filename/casing operations run in the shared process with isolated fixture files and no installed consumer, native producer or product child host.
func TestUnicornPreventAbbreviationsAppliesImportModeToExternalImportEquals(t *testing.T) {
  source := "import err = require(\"./local\");\nvoid err;\n"
  assertFixSnapshot(
    t,
    unicornPreventAbbreviationsRuleName,
    source,
    "import error = require(\"./local\");\nvoid error;\n",
  )
  assertRuleSkipsSourceWithOptions(
    t,
    unicornPreventAbbreviationsRuleName,
    source,
    `{"checkDefaultAndNamespaceImports":false}`,
  )
}
