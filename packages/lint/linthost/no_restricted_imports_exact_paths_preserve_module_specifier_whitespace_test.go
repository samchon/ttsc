package linthost

import (
  "encoding/json"
  "testing"
)

// TestNoRestrictedImportsExactPathsPreserveModuleSpecifierWhitespace verifies
// exact path restrictions compare module specifiers without trimming spaces.
//
// One source imports "pkg" and " pkg ". The rule runs twice over it, first with
// the positional path "pkg" and then with the positional path " pkg ".
//
// 1. Run the rule with "pkg" and expect only the `"pkg"` specifier.
// 2. Run the rule with " pkg " and expect only the `" pkg "` specifier.
//
// @evidence contracts/testing.md#behavioral-verification With the path "pkg" only the unpadded specifier is reported, and with the path " pkg " only the padded specifier is reported, so neither the option nor the module text is trimmed before comparison.
// @evidence contracts/testing.md#independent-expectations Module specifiers are exact strings under this rule. The two expected targets are the authored literal specifiers matching each option string.
// @evidence contracts/testing.md#distinguishing-cases The two invocations over one source reverse which specifier is forbidden, so a normalization that trims either side would report both specifiers or the wrong one. Trimmed comparison of module specifiers is the contract of no-duplicate-imports, a different rule.
// @evidence contracts/testing.md#execution-ownership runNoRestrictedImports calls runRuleFindingsSnapshot twice, which binds the rule at error severity, parses the source in a temporary project and runs Engine.Run in the Go test process. assertNoRestrictedImportsTargets compares each invocation with its literal target; the Test asserts no messages.
func TestNoRestrictedImportsExactPathsPreserveModuleSpecifierWhitespace(t *testing.T) {
  source := `import exact from "pkg";
import spaced from " pkg ";
JSON.stringify([exact, spaced]);
`
  exact := runNoRestrictedImports(t, source, json.RawMessage(`"pkg"`))
  assertNoRestrictedImportsTargets(t, exact, `"pkg"`)

  spaced := runNoRestrictedImports(t, source, json.RawMessage(`" pkg "`))
  assertNoRestrictedImportsTargets(t, spaced, `" pkg "`)
}
