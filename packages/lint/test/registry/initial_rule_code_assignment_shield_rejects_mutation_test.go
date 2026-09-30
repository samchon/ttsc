package linthost

import (
  "strings"
  "testing"
  "github.com/samchon/ttsc/packages/lint/internal/rulecode"
)

// TestInitialRuleCodeAssignmentShieldRejectsMutation proves a free renumber of
// an initially noncolliding rule cannot be blessed by current-ledger uniqueness.
//
//
//  1. Accept independent copies of the unchanged ledger and a newly appended identity.
//  2. Remove an original identity or change its code and require the corresponding compatibility error.
//
// @evidence contracts/testing.md#behavioral-verification The compatibility validator accepts the unchanged live ledger and an appended name, but rejects removal of an original rule and a changed code for a noncolliding original rule.
// @evidence contracts/testing.md#independent-expectations An introduced rule's name and code are immutable even if a replacement code is otherwise unique; a newly appended name does not change the historical snapshot obligation. Explicit missing and changed-code errors distinguish the two invalid mutations.
// @evidence contracts/testing.md#distinguishing-cases The unchanged and appended ledgers are positive controls; removal and the original noncollision code-plus-one mutation are negative controls. Copies prevent these probes from altering the process-global ledger.
// @evidence contracts/testing.md#execution-ownership Direct compatibility-validator calls consume independent map copies and the historical published-value snapshot in the shared Go process; no repository file layout or generated-output comparison substitutes for validation.
func TestInitialRuleCodeAssignmentShieldRejectsMutation(t *testing.T) {
  if err := validateInitialRuleCodeAssignments(builtInRuleCodes); err != nil {
    t.Fatalf("unchanged ledger rejected: %v", err)
  }
  legacyCounts := make(map[int32]int, len(initialRuleCodeAssignments))
  for name := range initialRuleCodeAssignments {
    legacyCounts[rulecode.Legacy(name)]++
  }
  mutated := make(map[string]int32, len(builtInRuleCodes))
  for name, code := range builtInRuleCodes {
    mutated[name] = code
  }
  for name, code := range initialRuleCodeAssignments {
    if legacyCounts[rulecode.Legacy(name)] != 1 {
      continue
    }
    mutated["contributor/new-compatibility-control"] = 17999
    if err := validateInitialRuleCodeAssignments(mutated); err != nil {
      t.Fatalf("appended ledger rejected: %v", err)
    }
    delete(mutated, name)
    if err := validateInitialRuleCodeAssignments(mutated); err == nil || !strings.Contains(err.Error(), "is missing from the append-only ledger") {
      t.Fatalf("missing original %q: %v", name, err)
    }
    mutated[name] = code + 1
    if err := validateInitialRuleCodeAssignments(mutated); err == nil || !strings.Contains(err.Error(), "changed diagnostic code") {
      t.Fatalf("initial noncollision mutation for %q: %v", name, err)
    }
    return
  }
  t.Fatal("initial manifest contains no noncolliding assignment to mutate")
}
