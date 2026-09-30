package linthost

import (
  "encoding/json"
  "strings"
  "testing"
)

// TestNoRestrictedImportsAllowedNamesRejectOnlyTheComplement verifies Allowed-name restrictions retain safe named imports while reporting default, unsafe and namespace exposures, with the custom message.
//
// Pins the distinct option, syntax or failure branch represented by this fixture.
//
// 1. Supply the authored source and configuration inputs.
// 2. Run the owning engine or command operation in this process.
// 3. Compare the literal findings, messages or failure state below.
//
// @evidence contracts/testing.md#behavioral-verification Allowed-name restrictions retain safe named imports while reporting default, unsafe and namespace exposures, with the custom message.
// @evidence contracts/testing.md#independent-expectations allowImportNames safe defines a complement restriction; four literal target substrings and only-safe message fragments follow that policy independently.
// @evidence contracts/testing.md#distinguishing-cases Named safe controls coexist with unsafe alias, default and namespace import/reexport forms.
// @evidence contracts/testing.md#execution-ownership runNoRestrictedImports calls runRuleFindingsSnapshot for this entry's authored source/options and validates rule, ranges and absence of edits. assertNoRestrictedImportsTargets compares the displayed literal target list; this Test owns every invocation and message assertion in the Go process.
func TestNoRestrictedImportsAllowedNamesRejectOnlyTheComplement(t *testing.T) {
  source := `import Default, { safe, unsafe } from "pkg/module";
import * as namespace from "pkg/module";
export { safe, unsafe as renamed } from "pkg/module";
void Default;
void namespace;
`
  findings := runNoRestrictedImports(
    t,
    source,
    json.RawMessage(`{"patterns":[{"group":["pkg/*"],"allowImportNames":["safe"],"message":"Use the public name."}]}`),
  )
  assertNoRestrictedImportsTargets(t, findings, "Default", "unsafe", "* as namespace", "unsafe as renamed")
  for _, finding := range findings {
    if !strings.Contains(finding.message, "only 'safe'") || !strings.HasSuffix(finding.message, "Use the public name.") {
      t.Fatalf("allow-list diagnostic mismatch: %+v", finding)
    }
  }
}
