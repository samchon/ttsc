package linthost

import (
  "sort"
  "testing"
  "github.com/samchon/ttsc/packages/lint/internal/rulecode"
)

// TestInitialRuleCodeAssignmentsRemainFrozen verifies the complete
// ledger-introduction snapshot while allowing later names to be appended.
//
//
//  1. Check every published introduction assignment against the live ledger.
//  2. Group historical names by the legacy hash and require unchanged incumbents and 21 migrated collision groups.
//
// @evidence contracts/testing.md#behavioral-verification Every originally published rule retains its diagnostic code in the live built-in ledger; the migration keeps each legacy collision group's lexical incumbent and moves every loser off that shared code.
// @evidence contracts/testing.md#independent-expectations The separate 743-entry introduction snapshot records the published compatibility values rather than regenerating answers from the current allocator. The migration's 21 collision groups and lexical incumbent policy are additional expectations, not a comparison of two live allocations.
// @evidence contracts/testing.md#distinguishing-cases All snapshot entries, singleton legacy groups, incumbents and collision losers are inspected; later ledger additions remain legal, but removal or renumbering of an original name does not.
// @evidence contracts/testing.md#execution-ownership The in-process live ledger is compared with historical protocol data and grouped by the public legacy hash. No committed-file existence, generated text, install, child process or native host is asserted.
func TestInitialRuleCodeAssignmentsRemainFrozen(t *testing.T) {
  if err := validateInitialRuleCodeAssignments(builtInRuleCodes); err != nil {
    t.Fatal(err)
  }

  legacyGroups := make(map[int32][]string, len(initialRuleCodeAssignments))
  for name := range initialRuleCodeAssignments {
    legacy := rulecode.Legacy(name)
    legacyGroups[legacy] = append(legacyGroups[legacy], name)
  }
  collisionGroups := 0
  for legacy, names := range legacyGroups {
    sort.Strings(names)
    if code := initialRuleCodeAssignments[names[0]]; code != legacy {
      t.Fatalf("initial migration incumbent %q moved from %d to %d", names[0], legacy, code)
    }
    if len(names) == 1 {
      continue
    }
    collisionGroups++
    for _, name := range names[1:] {
      if code := initialRuleCodeAssignments[name]; code == legacy {
        t.Fatalf("initial migration collision loser %q retained incumbent code %d", name, legacy)
      }
    }
  }
  if collisionGroups != 21 {
    t.Fatalf("initial migration has %d collision groups, want 21", collisionGroups)
  }
}
