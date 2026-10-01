package linthost

import (
  "encoding/json"
  "testing"
)

// TestNoRestrictedImportsStringPatternsKeepGitignoreParentNegationSemantics
// verifies string patterns ["lib/*", "!lib/public"] restrict lib/private/value
// but exempt descendants of lib/public.
//
// 1. Run the rule with the two string patterns over three imports.
// 2. Compare the reported ranges with the single literal target.
//
// @evidence contracts/testing.md#behavioral-verification Only `import "lib/private/value"` is reported; "lib/public/value", whose parent directory is re-included by the negation, and "other/value" are not.
// @evidence contracts/testing.md#independent-expectations Gitignore-style semantics with the ordered patterns lib/* then !lib/public re-include the lib/public directory, so only lib/private/value is expected; the expectation is one authored literal.
// @evidence contracts/testing.md#distinguishing-cases A private child, a public child and an unrelated module distinguish negation of a parent directory from matching every child of lib or matching none.
// @evidence contracts/testing.md#execution-ownership runNoRestrictedImports calls runRuleFindingsSnapshot, which binds the rule at error severity, parses the source in a temporary project and runs Engine.Run in the Go test process, then rejects other rules, edits and invalid ranges. assertNoRestrictedImportsTargets compares the one literal range; the Test asserts no messages.
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
