package linthost

import (
  "strings"
  "testing"
)

// TestUnicornPreventAbbreviationsOffersWholeBindingSuggestionsForAmbiguousNames verifies that actual rule execution checks two titled suggestions, no autofix and both exact declaration/reference edits for each candidate.
//
// The supported ambiguous e dictionary offers error/event, with the occupied event global requiring event_; authored identifier offsets and replacement texts establish each edit independently.
//
// 1. Execute the retained binding, filename, option or command variants.
// 2. Compare the authored diagnostic, edit, helper value or preserved source.
//
// @evidence contracts/testing.md#behavioral-verification Actual rule execution checks two titled suggestions, no autofix and both exact declaration/reference edits for each candidate.
// @evidence contracts/testing.md#independent-expectations The supported ambiguous e dictionary offers error/event, with the occupied event global requiring event_; authored identifier offsets and replacement texts establish each edit independently.
// @evidence contracts/testing.md#distinguishing-cases Both suggestions must consistently replace only the two e identifiers, while the original source is not automatically edited.
// @evidence contracts/testing.md#execution-ownership TestUnicornPreventAbbreviationsOffersWholeBindingSuggestionsForAmbiguousNames owns its explicit variants and named subcases where present as a discoverable Go unit entry; actual checker/engine/fix/filename/casing operations run in the shared process with isolated fixture files and no installed consumer, native producer or product child host.
func TestUnicornPreventAbbreviationsOffersWholeBindingSuggestionsForAmbiguousNames(t *testing.T) {
  source := "const e = 1;\nconsole.log(e);\n"
  _, _, findings := runRuleFindingsSnapshot(t, unicornPreventAbbreviationsRuleName, source, nil)
  assertUnicornRuleErrorFindingIdentities(t, unicornPreventAbbreviationsRuleName, findings)
  if len(findings) != 1 {
    t.Fatalf("expected one diagnostic, got %d (%+v)", len(findings), findings)
  }
  finding := findings[0]
  if len(finding.Fix) != 0 || len(finding.Suggestions) != 2 {
    t.Fatalf("expected two suggestions and no autofix, got fix=%+v suggestions=%+v", finding.Fix, finding.Suggestions)
  }
  if finding.Suggestions[0].Title != "Rename to `error`." || len(finding.Suggestions[0].Edits) != 2 ||
    finding.Suggestions[1].Title != "Rename to `event_`." || len(finding.Suggestions[1].Edits) != 2 {
    t.Fatalf("unexpected suggestions: %+v", finding.Suggestions)
  }
  declaration := strings.Index(source, "e =")
  reference := strings.Index(source, "log(e)") + len("log(")
  for index, replacement := range []string{"error", "event_"} {
    edits := finding.Suggestions[index].Edits
    if edits[0].Pos != declaration || edits[0].End != declaration+1 || edits[0].Text != replacement ||
      edits[1].Pos != reference || edits[1].End != reference+1 || edits[1].Text != replacement {
      t.Fatalf("suggestion %d must consistently rename only both e identifiers to %q: %+v", index, replacement, edits)
    }
  }
}
