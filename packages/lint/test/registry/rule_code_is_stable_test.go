package linthost

import (
  "fmt"
)

func validateInitialRuleCodeAssignments(current map[string]int32) error {
  if len(initialRuleCodeAssignments) != 743 {
    return fmt.Errorf("initial rule-code manifest has %d entries, want 743", len(initialRuleCodeAssignments))
  }
  for name, want := range initialRuleCodeAssignments {
    got, exists := current[name]
    if !exists {
      return fmt.Errorf("initial rule %q is missing from the append-only ledger", name)
    }
    if got != want {
      return fmt.Errorf("initial rule %q changed diagnostic code from %d to %d", name, want, got)
    }
  }
  return nil
}
