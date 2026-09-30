package linthost

import (
  "encoding/json"
  "testing"
)

// TestNoRestrictedImportsExactPathsPreserveModuleSpecifierWhitespace verifies Exact path restrictions preserve spaces in the module specifier rather than trimming them.
//
// Pins the distinct option, syntax or failure branch represented by this fixture.
//
// 1. Supply the authored source and configuration inputs.
// 2. Run the owning engine or command operation in this process.
// 3. Compare the literal findings, messages or failure state below.
//
// @evidence contracts/testing.md#behavioral-verification Exact path restrictions preserve spaces in the module specifier rather than trimming them.
// @evidence contracts/testing.md#independent-expectations Node module strings are exact strings under this rule; separate literal pkg and spaced pkg options require their corresponding literal targets.
// @evidence contracts/testing.md#distinguishing-cases Two independent engine invocations reverse which exact specifier is forbidden, detecting normalization that merges them.
// @evidence contracts/testing.md#execution-ownership runNoRestrictedImports calls runRuleFindingsSnapshot for this entry's authored source/options and validates rule, ranges and absence of edits. assertNoRestrictedImportsTargets compares the displayed literal target list; this Test owns every invocation and message assertion in the Go process.
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
