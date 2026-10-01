package linthost

import (
  "testing"
)

// TestUnicornPreventAbbreviationsRenamesDefaultExportLocalNames verifies that the real fixer checks an authored recursive default-function rename.
//
// A default export does not expose its local function name as a named export; binding identity independently requires updating the recursive local reference.
//
// @evidence contracts/testing.md#behavioral-verification The real fixer checks an authored recursive default-function rename.
// @evidence contracts/testing.md#independent-expectations A default export does not expose its local function name as a named export; binding identity independently requires updating the recursive local reference.
// @evidence contracts/testing.md#distinguishing-cases The default function declaration and recursive err call both become error.
// @evidence contracts/testing.md#execution-ownership TestUnicornPreventAbbreviationsRenamesDefaultExportLocalNames owns its explicit variants and named subcases where present as a discoverable Go unit entry; Checker-backed rule snapshots and actual disk fix application run in the shared Go process with isolated authored fixture files; no installed consumer, native producer or product child host runs.
func TestUnicornPreventAbbreviationsRenamesDefaultExportLocalNames(t *testing.T) {
  source := "export default function err(depth: number): void {\n  if (depth > 0) err(depth - 1);\n}\n"
  assertFixSnapshot(
    t,
    unicornPreventAbbreviationsRuleName,
    source,
    "export default function error(depth: number): void {\n  if (depth > 0) error(depth - 1);\n}\n",
  )
}
