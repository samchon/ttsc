package rulecode_test

import (
  "fmt"
  "reflect"
  "strings"
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
//
// @evidence contracts/testing.md#behavioral-verification rulecode.Allocate rejects both out-of-range endpoints, duplicate frozen codes and a completely occupied band, while accepting empty allocation and both valid band endpoints without mutating the caller's map.
// @evidence contracts/testing.md#independent-expectations The published reserved interval is [9000,18000), frozen names must have unique codes, and no further assignment exists when all 9000 slots are occupied. Literal error classes and valid endpoint assignments distinguish those failures from arbitrary errors.
// @evidence contracts/testing.md#distinguishing-cases Below minimum, exclusive maximum, duplicate minimum and full-band overflow retain all original failures; empty and inclusive endpoint controls prove the allocator does not reject valid ledgers, and result mutation checks caller ownership.
// @evidence contracts/testing.md#execution-ownership Direct public Allocate calls consume authored in-memory ledgers in the owning rulecode Go test process, including the complete exhaustion input; no file layout, generated snapshot or native host is used as an oracle.
func TestRuleCodeAllocatorRejectsInvalidOrExhaustedLedgers(t *testing.T) {
  invalidLedgers := []map[string]int32{
    {"below": rulecode.Minimum - 1},
    {"above": rulecode.MaximumExclusive},
    {"left": rulecode.Minimum, "right": rulecode.Minimum},
  }
  errorClasses := []string{"out-of-range diagnostic code", "out-of-range diagnostic code", "share diagnostic code"}
  for index, ledger := range invalidLedgers {
    if _, err := rulecode.Allocate(ledger, nil); err == nil || !strings.Contains(err.Error(), errorClasses[index]) {
      t.Fatalf("invalid ledger %d: expected %q, got %v; input %#v", index, errorClasses[index], err, ledger)
    }
  }

  full := make(map[string]int32, rulecode.MaximumExclusive-rulecode.Minimum)
  for code := rulecode.Minimum; code < rulecode.MaximumExclusive; code++ {
    full[fmt.Sprintf("frozen/%d", code)] = code
  }
  if _, err := rulecode.Allocate(full, []string{"contributor/overflow"}); err == nil || err.Error() != "lint diagnostic code range [9000, 18000) is exhausted" {
    t.Fatalf("expected reserved-band exhaustion error, got %v", err)
  }
  empty, err := rulecode.Allocate(nil, nil)
  if err != nil || len(empty) != 0 {
    t.Fatalf("empty allocation rejected: %v %v", empty, err)
  }
  valid := map[string]int32{"minimum": 9000, "maximum": 17999}
  assigned, err := rulecode.Allocate(valid, nil)
  if err != nil || !reflect.DeepEqual(assigned, valid) {
    t.Fatalf("valid endpoint ledger rejected: %v %v", assigned, err)
  }
  assigned["minimum"] = 9001
  if valid["minimum"] != 9000 {
    t.Fatalf("result mutation changed frozen input: %v", valid)
  }
}
