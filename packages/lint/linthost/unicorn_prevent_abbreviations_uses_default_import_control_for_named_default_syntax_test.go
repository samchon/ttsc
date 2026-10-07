package linthost

import (
  "testing"
)

// TestUnicornPreventAbbreviationsUsesDefaultImportControlForNamedDefaultSyntax verifies that the engine/fixer distinguishes default-import policy on a named default specifier.
//
// A default-as binding independently belongs to the default-import control rather than ordinary shorthand-import policy.
//
// @evidence contracts/testing.md#behavioral-verification The engine/fixer distinguishes default-import policy on a named default specifier.
// @evidence contracts/testing.md#independent-expectations A default-as binding independently belongs to the default-import control rather than ordinary shorthand-import policy.
// @evidence contracts/testing.md#distinguishing-cases External named-default err is clean by default and renames only when default/namespace checking is enabled.
// @evidence contracts/testing.md#execution-ownership TestUnicornPreventAbbreviationsUsesDefaultImportControlForNamedDefaultSyntax owns its explicit variants and named subcases where present as a discoverable Go unit entry; Checker-backed rule snapshots and actual disk fix application run in the shared Go process with isolated authored fixture files; no installed consumer, native producer or product child host runs.
func TestUnicornPreventAbbreviationsUsesDefaultImportControlForNamedDefaultSyntax(t *testing.T) {
  source := "import { default as err } from \"external\";\nvoid err;\n"
  assertRuleSkipsSource(t, unicornPreventAbbreviationsRuleName, source)
  assertFixSnapshotWithOptions(
    t,
    unicornPreventAbbreviationsRuleName,
    source,
    `{"checkDefaultAndNamespaceImports":true}`,
    "import { default as error } from \"external\";\nvoid error;\n",
  )
}
