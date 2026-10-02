package rulecode_test

import (
  "fmt"
  "hash/fnv"
  "math/rand"
  "reflect"
  "testing"

  "github.com/samchon/ttsc/packages/lint/internal/rulecode"
)

// TestRuleCodeAllocatorIsOrderIndependentAndAppendOnly verifies allocation is
// a function of the complete name set and frozen ledger, never insertion order.
//
// A new rule that hashes onto an existing assignment must move without changing
// the existing rule. Randomized permutations guard against accidentally using
// map or registration order in either the primary reservation or probe phases.
//
//  1. Discover two synthetic names with the same legacy code.
//  2. Freeze the first assignment and require the second to probe elsewhere.
//  3. Shuffle a larger name set repeatedly and require byte-for-byte mappings.
//
// @evidence contracts/testing.md#behavioral-verification rulecode.Allocate preserves frozen assignments and allocates distinct codes for colliding names independent of 32 input permutations; Legacy preferences also match Go's standard FNV-1a reference for the complete authored name population.
// @evidence contracts/testing.md#independent-expectations Frozen literal assignments and collision uniqueness define append-only correctness independently of either allocation. Standard hash/fnv plus the documented [9000,18000) band supplies a separate preferred-code oracle; comparing two allocations alone establishes ordering, not the preferred assignment.
// @evidence contracts/testing.md#distinguishing-cases A new collision, a lexically earlier newcomer versus a later frozen incumbent, an unchanged input map and 130 names under 32 permutations distinguish compatibility precedence, uniqueness, input ownership and insertion-order dependence.
// @evidence contracts/testing.md#execution-ownership The public allocator and hashing operation run directly in the owning rulecode Go test process with authored maps and names; synthesized collision names are inputs, not expected outputs, and no generator, native artifact or committed-file comparison executes.
func TestRuleCodeAllocatorIsOrderIndependentAndAppendOnly(t *testing.T) {
  left, right := findSyntheticRuleCodeCollision(t)
  frozen := map[string]int32{"frozen/existing": rulecode.Minimum}
  base, err := rulecode.Allocate(frozen, []string{left})
  if err != nil {
    t.Fatalf("allocate base ledger: %v", err)
  }
  expanded, err := rulecode.Allocate(base, []string{left, right})
  if err != nil {
    t.Fatalf("allocate colliding rule: %v", err)
  }
  if expanded[left] != base[left] {
    t.Fatalf("existing rule %q changed from %d to %d", left, base[left], expanded[left])
  }
  if expanded[right] == expanded[left] {
    t.Fatalf("colliding rules %q and %q share code %d", left, right, expanded[left])
  }
  if len(frozen) != 1 || frozen["frozen/existing"] != rulecode.Minimum {
    t.Fatalf("allocator mutated frozen input: %#v", frozen)
  }

  // A later rule may sort before the historical incumbent. Append-only
  // compatibility still wins over lexical order once the incumbent is frozen.
  earlier, later := left, right
  if earlier > later {
    earlier, later = later, earlier
  }
  laterIncumbent := map[string]int32{later: rulecode.Legacy(later)}
  earlierNewcomer, err := rulecode.Allocate(laterIncumbent, []string{earlier})
  if err != nil {
    t.Fatalf("allocate alphabetically earlier collision: %v", err)
  }
  if earlierNewcomer[later] != laterIncumbent[later] {
    t.Fatalf("later-sorting incumbent %q changed from %d to %d", later, laterIncumbent[later], earlierNewcomer[later])
  }
  if earlierNewcomer[earlier] == earlierNewcomer[later] {
    t.Fatalf("alphabetically earlier newcomer %q displaced incumbent %q", earlier, later)
  }

  names := []string{left, right}
  for index := 0; index < 128; index++ {
    names = append(names, fmt.Sprintf("contributor/order-shield-%03d", index))
  }
  for _, name := range names {
    reference := fnv.New32a()
    _, _ = reference.Write([]byte(name))
    preferred := int32(9000 + reference.Sum32()%9000)
    if got := rulecode.Legacy(name); got != preferred {
      t.Fatalf("legacy preference for %q differs from standard FNV-1a: %d != %d", name, got, preferred)
    }
  }
  reference := fnv.New32a()
  _, _ = reference.Write([]byte(left))
  if got, preferred := base[left], int32(9000+reference.Sum32()%9000); got != preferred {
    t.Fatalf("unoccupied preference changed: %d != %d", got, preferred)
  }
  want, err := rulecode.Allocate(frozen, names)
  if err != nil {
    t.Fatalf("allocate reference mapping: %v", err)
  }
  for seed := int64(0); seed < 32; seed++ {
    shuffled := append([]string(nil), names...)
    rand.New(rand.NewSource(seed)).Shuffle(len(shuffled), func(i, j int) {
      shuffled[i], shuffled[j] = shuffled[j], shuffled[i]
    })
    got, allocationErr := rulecode.Allocate(frozen, shuffled)
    if allocationErr != nil {
      t.Fatalf("allocate shuffled mapping for seed %d: %v", seed, allocationErr)
    }
    if !reflect.DeepEqual(got, want) {
      t.Fatalf("allocation changed with input order for seed %d", seed)
    }
  }
}

func findSyntheticRuleCodeCollision(t *testing.T) (string, string) {
  t.Helper()
  seen := make(map[int32]string)
  for index := 0; index < 20000; index++ {
    name := fmt.Sprintf("contributor/collision-shield-%05d", index)
    code := rulecode.Legacy(name)
    if code == rulecode.Minimum {
      continue
    }
    if previous, exists := seen[code]; exists {
      return previous, name
    }
    seen[code] = name
  }
  t.Fatal("failed to find a synthetic legacy-code collision")
  return "", ""
}
