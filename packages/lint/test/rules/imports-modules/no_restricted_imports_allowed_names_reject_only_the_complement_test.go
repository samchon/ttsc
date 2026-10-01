package linthost

import (
  "encoding/json"
  "strings"
  "testing"
)

// TestNoRestrictedImportsAllowedNamesRejectOnlyTheComplement verifies a pattern
// restriction with allowImportNames ["safe"] keeps the `safe` specifiers and
// reports every other way of reaching the module.
//
// The source imports a default binding with { safe, unsafe }, imports the
// namespace, and re-exports { safe, unsafe as renamed } from "pkg/module"; the
// group "pkg/*" carries the custom message "Use the public name.".
//
// 1. Run the rule with the group, allowImportNames and message options.
// 2. Compare the reported source ranges with the literal list.
// 3. Require each message to contain "only 'safe'" and end with the custom message.
//
// @evidence contracts/testing.md#behavioral-verification The rule is run with the allow-list pattern over the authored source. The default binding, the unsafe import specifier, the namespace import and the renamed reexport specifier are reported with the allow-list message and the custom suffix; both safe specifiers, the import and the reexport one, are not.
// @evidence contracts/testing.md#independent-expectations allowImportNames ["safe"] defines a complement restriction, so every exposure other than the name safe is forbidden. The four expected source ranges (Default, unsafe, * as namespace, unsafe as renamed) and the "only 'safe'" and custom-message fragments are authored literals.
// @evidence contracts/testing.md#distinguishing-cases The allowed name safe appears in both an import and a reexport next to the forbidden unsafe alias, the default binding and the namespace import, so a gate that rejects everything or only the import side fails.
// @evidence contracts/testing.md#execution-ownership runNoRestrictedImports calls runRuleFindingsSnapshot, which binds the rule at error severity, parses the source in a temporary project and runs Engine.Run in the Go test process, then rejects other rules, edits and invalid ranges. assertNoRestrictedImportsTargets compares the four literal ranges, and the loop in the Test body checks every message.
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
