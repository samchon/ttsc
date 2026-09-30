package linthost

import (
  "encoding/json"
  "testing"
)

// TestNoRestrictedImportsStringPatternsKeepGitignoreParentNegationSemantics verifies String pattern negation exempts descendants of lib/public while retaining lib/private restriction.
//
// Pins the distinct option, syntax or failure branch represented by this fixture.
//
// 1. Supply the authored source and configuration inputs.
// 2. Run the owning engine or command operation in this process.
// 3. Compare the literal findings, messages or failure state below.
//
// @evidence contracts/testing.md#behavioral-verification String pattern negation exempts descendants of lib/public while retaining lib/private restriction.
// @evidence contracts/testing.md#independent-expectations The authored lib/* and !lib/public pattern sequence follows the supported gitignore-style parent exception; only private/value is in the literal target list.
// @evidence contracts/testing.md#distinguishing-cases A private child, a public child and other/value distinguish negation traversal from matching all children or no children.
// @evidence contracts/testing.md#execution-ownership runNoRestrictedImports calls runRuleFindingsSnapshot for this entry's authored source/options and validates rule, ranges and absence of edits. assertNoRestrictedImportsTargets compares the displayed literal target list; this Test owns every invocation and message assertion in the Go process.
func TestNoRestrictedImportsStringPatternsKeepGitignoreParentNegationSemantics(t *testing.T) {
  source := `import "lib/private/value";
import "lib/public/value";
import "other/value";
`
  findings := runNoRestrictedImports(
    t,
    source,
    json.RawMessage(`{"patterns":["lib/*","!lib/public"]}`),
  )
  assertNoRestrictedImportsTargets(t, findings, `"lib/private/value"`)
}
