package linthost

import (
	"fmt"
	"testing"

	"github.com/samchon/ttsc/packages/lint/internal/rulecode"
)

// TestRuleCodeAllocatorRejectsInvalidOrExhaustedLedgers verifies allocation
// fails closed when the compatibility ledger cannot support unique codes.
//
// Accepting an out-of-band or duplicate frozen entry would publish ambiguous
// diagnostics. Silently wrapping after all 9,000 slots are occupied would do
// the same, so exhaustion must be an explicit error rather than code reuse.
//
//  1. Reject frozen entries below and above the reserved band.
//  2. Reject two frozen names sharing one code.
//  3. Fill every slot and require allocation of one more rule to fail.
func TestRuleCodeAllocatorRejectsInvalidOrExhaustedLedgers(t *testing.T) {
	invalidLedgers := []map[string]int32{
		{"below": rulecode.Minimum - 1},
		{"above": rulecode.MaximumExclusive},
		{"left": rulecode.Minimum, "right": rulecode.Minimum},
	}
	for index, ledger := range invalidLedgers {
		if _, err := rulecode.Allocate(ledger, nil); err == nil {
			t.Fatalf("invalid ledger %d was accepted: %#v", index, ledger)
		}
	}

	full := make(map[string]int32, rulecode.MaximumExclusive-rulecode.Minimum)
	for code := rulecode.Minimum; code < rulecode.MaximumExclusive; code++ {
		full[fmt.Sprintf("frozen/%d", code)] = code
	}
	if _, err := rulecode.Allocate(full, []string{"contributor/overflow"}); err == nil {
		t.Fatal("allocator reused a code after the reserved band was exhausted")
	}
}
