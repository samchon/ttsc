package linthost

import (
  "encoding/json"
  "testing"
)

// TestNoRestrictedImportsAllowedNamePatternCoversImportsAndReexports verifies
// allowImportNamePattern "^public" exempts publicValue and publicType and
// reports privateValue and privateType, in an import and a reexport.
//
// The pattern entry is a regex "^pkg/" restriction applied to one import and one
// `export { … } from` declaration of "pkg/names".
//
// 1. Run the rule with the regex and allowImportNamePattern options.
// 2. Compare the reported specifier ranges with the literal list.
//
// @evidence contracts/testing.md#behavioral-verification The rule reports privateValue in the import and privateType in the reexport, and does not report publicValue or publicType, so the allowed-name regex is applied to both declaration kinds.
// @evidence contracts/testing.md#independent-expectations The literal ^public prefix decides which authored names are allowed; the two expected targets are the names that do not start with public. The test does not assert message text.
// @evidence contracts/testing.md#distinguishing-cases Each declaration holds one allowed and one forbidden adjacent name, so a gate applied only to imports, only to reexports or to every name produces a different target list.
// @evidence contracts/testing.md#execution-ownership runNoRestrictedImports calls runRuleFindingsSnapshot, which binds the rule at error severity, parses the source in a temporary project and runs Engine.Run in the Go test process, then rejects other rules, edits and invalid ranges. assertNoRestrictedImportsTargets compares the two literal target ranges.
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
