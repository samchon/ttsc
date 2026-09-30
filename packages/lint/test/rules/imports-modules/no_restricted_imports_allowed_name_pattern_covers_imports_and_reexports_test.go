package linthost

import (
  "encoding/json"
  "testing"
)

// TestNoRestrictedImportsAllowedNamePatternCoversImportsAndReexports verifies The allowed-name regex exempts publicValue/publicType and reports privateValue/privateType across import and reexport.
//
// Pins the distinct option, syntax or failure branch represented by this fixture.
//
// 1. Supply the authored source and configuration inputs.
// 2. Run the owning engine or command operation in this process.
// 3. Compare the literal findings, messages or failure state below.
//
// @evidence contracts/testing.md#behavioral-verification The allowed-name regex exempts publicValue/publicType and reports privateValue/privateType across import and reexport.
// @evidence contracts/testing.md#independent-expectations The literal ^public prefix independently determines which authored source names are allowed; the private targets are supplied directly.
// @evidence contracts/testing.md#distinguishing-cases Both declaration kinds contain allowed and forbidden adjacent names, detecting a gate applied only to imports or to every name.
// @evidence contracts/testing.md#execution-ownership runNoRestrictedImports calls runRuleFindingsSnapshot for this entry's authored source/options and validates rule, ranges and absence of edits. assertNoRestrictedImportsTargets compares the displayed literal target list; this Test owns every invocation and message assertion in the Go process.
func TestNoRestrictedImportsAllowedNamePatternCoversImportsAndReexports(t *testing.T) {
  source := `import { publicValue, privateValue } from "pkg/names";
export { publicType, privateType } from "pkg/names";
`
  findings := runNoRestrictedImports(
    t,
    source,
    json.RawMessage(`{"patterns":[{"regex":"^pkg/","allowImportNamePattern":"^public"}]}`),
  )
  assertNoRestrictedImportsTargets(t, findings, "privateValue", "privateType")
}
