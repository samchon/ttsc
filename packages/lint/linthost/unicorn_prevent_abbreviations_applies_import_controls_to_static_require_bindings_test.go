package linthost

import (
  "testing"
)

// TestUnicornPreventAbbreviationsAppliesImportControlsToStaticRequireBindings verifies that the real fixer checks authored internal/external require defaults and the disabled-control clean source.
//
// Direct static require binding imports independently follow module-origin and explicit import policy.
//
// @evidence contracts/testing.md#behavioral-verification The real fixer checks authored internal/external require defaults and the disabled-control clean source.
// @evidence contracts/testing.md#independent-expectations Direct static require binding imports independently follow module-origin and explicit import policy.
// @evidence contracts/testing.md#distinguishing-cases Internal err becomes error by default, external ctx stays unchanged, and disabling the import control suppresses both.
// @evidence contracts/testing.md#execution-ownership TestUnicornPreventAbbreviationsAppliesImportControlsToStaticRequireBindings owns its explicit variants and named subcases where present as a discoverable Go unit entry; Checker-backed rule snapshots and actual disk fix application run in the shared Go process with isolated authored fixture files; no installed consumer, native producer or product child host runs.
func TestUnicornPreventAbbreviationsAppliesImportControlsToStaticRequireBindings(t *testing.T) {
  source := "declare function require(name: string): unknown;\nconst err = require(\"./local\");\nconst ctx = require(\"external\");\nvoid [err, ctx];\n"
  assertFixSnapshot(
    t,
    unicornPreventAbbreviationsRuleName,
    source,
    "declare function require(name: string): unknown;\nconst error = require(\"./local\");\nconst ctx = require(\"external\");\nvoid [error, ctx];\n",
  )
  assertRuleSkipsSourceWithOptions(
    t,
    unicornPreventAbbreviationsRuleName,
    source,
    `{"checkDefaultAndNamespaceImports":false}`,
  )
}
