package linthost

import (
  "encoding/json"
  "strings"
  "testing"
)

// TestNoRestrictedImportsPatternsHonorNegationCaseRegexAndNamePatterns verifies Pattern restrictions combine group negation, case-sensitive module regex and forbidden import-name regex without losing custom message suffixes.
//
// Pins the distinct option, syntax or failure branch represented by this fixture.
//
// 1. Supply the authored source and configuration inputs.
// 2. Run the owning engine or command operation in this process.
// 3. Compare the literal findings, messages or failure state below.
//
// @evidence contracts/testing.md#behavioral-verification Pattern restrictions combine group negation, case-sensitive module regex and forbidden import-name regex without losing custom message suffixes.
// @evidence contracts/testing.md#independent-expectations The literal lib/* minus lib/pick group and case-sensitive ^@internal/ policy determine the three authored targets independently.
// @evidence contracts/testing.md#distinguishing-cases LIB/private reports, LIB/pick is exempt; secret and unsafeThing report but safe and mixed-case @Internal remain clean.
// @evidence contracts/testing.md#execution-ownership runNoRestrictedImports calls runRuleFindingsSnapshot for this entry's authored source/options and validates rule, ranges and absence of edits. assertNoRestrictedImportsTargets compares the displayed literal target list; this Test owns every invocation and message assertion in the Go process.
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
