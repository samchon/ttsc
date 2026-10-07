package linthost

import (
  "encoding/json"
  "strings"
  "testing"
)

// TestNoRestrictedImportsPatternsHonorNegationCaseRegexAndNamePatterns
// verifies pattern entries combine group negation, a case-sensitive module
// regex and an import-name pattern, and append their custom messages.
//
// Two pattern entries run together: group ["lib/*", "!lib/pick"] with the
// message "Grouped restriction.", and regex "^@internal/" (case sensitive) with
// importNames ["secret"], importNamePattern "^unsafe" and the message
// "Internal name.".
//
// 1. Run the rule over two lib imports and two @internal imports.
// 2. Compare the three reported ranges with the literal list.
// 3. Check the exact group message and that the name findings end with the second message.
//
// @evidence contracts/testing.md#behavioral-verification "LIB/private" is reported with the exact pattern message plus "Grouped restriction.", "LIB/pick" is exempt through the negation, `secret` and `unsafeThing` are reported from "@internal/pkg" with a message ending in "Internal name.", and `safe` and the "@Internal/pkg" import are not reported.
// @evidence contracts/testing.md#independent-expectations The group lib/* minus lib/pick (matched case-insensitively by default) and the case-sensitive ^@internal/ regex determine the three expected targets and the message texts, which are authored literals.
// @evidence contracts/testing.md#distinguishing-cases LIB/pick versus LIB/private isolates the negation; the same name secret imported from "@Internal/pkg" is clean while it is reported from "@internal/pkg", isolating caseSensitive; safe next to secret and unsafeThing isolates the name filters.
// @evidence contracts/testing.md#execution-ownership runNoRestrictedImports calls runRuleFindingsSnapshot, which binds the rule at error severity, parses the source in a temporary project and runs Engine.Run in the Go test process, then rejects other rules, edits and invalid ranges. assertNoRestrictedImportsTargets compares the three literal ranges, and the Test body compares the group message and the suffix of the other two.
func TestNoRestrictedImportsPatternsHonorNegationCaseRegexAndNamePatterns(t *testing.T) {
  source := `import "LIB/private";
import "LIB/pick";
import { secret, unsafeThing, safe } from "@internal/pkg";
import { secret as allowedByCase } from "@Internal/pkg";
`
  findings := runNoRestrictedImports(
    t,
    source,
    json.RawMessage(`{"patterns":[{"group":["lib/*","!lib/pick"],"message":"Grouped restriction."},{"regex":"^@internal/","caseSensitive":true,"importNames":["secret"],"importNamePattern":"^unsafe","message":"Internal name."}]}`),
  )
  assertNoRestrictedImportsTargets(t, findings, `"LIB/private"`, "secret", "unsafeThing")
  if findings[0].message != "'LIB/private' import is restricted from being used by a pattern. Grouped restriction." {
    t.Fatalf("group message mismatch: %+v", findings[0])
  }
  for _, finding := range findings[1:] {
    if !strings.HasSuffix(finding.message, "Internal name.") {
      t.Fatalf("pattern custom message was not appended: %+v", finding)
    }
  }
}
