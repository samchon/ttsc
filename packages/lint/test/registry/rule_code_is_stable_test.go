package linthost

import (
  "fmt"
  "sort"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/lint/internal/rulecode"
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

// TestInitialRuleCodeAssignmentsRemainFrozen verifies the complete
// ledger-introduction snapshot while allowing later names to be appended.
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

// TestInitialRuleCodeAssignmentShieldRejectsMutation proves a free renumber of
// an initially noncolliding rule cannot be blessed by current-ledger uniqueness.
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

// TestRuleCodesAreUniqueAcrossCompleteRegistry verifies the frozen built-in
// ledger and every loaded runtime rule occupy one collision-free code space.
//
// The ledger is the compatibility contract: existing entries, including
// tombstones for removed rules, must remain unique and in the TS-style band.
// The separate initial snapshot freezes published assignments without treating
// future appended rules as members of the one-time migration.
//
//  1. Require every active built-in to exist in the ledger.
//  2. Assert ledger and complete loaded registry codes are unique and in range.
//  3. Pin every pair reported in #492 after the full snapshot check above.
//
// @evidence contracts/testing.md#behavioral-verification The full built-in ledger, including removed-rule reservations, and all loaded file and project rule identities have distinct codes in the reserved interval; active built-ins are represented in the ledger while runtime contributors need not be.
// @evidence contracts/testing.md#independent-expectations The [9000,18000) protocol and uniqueness across different public identities define the expected result. Eleven historically colliding pairs are authored regression inputs; no current allocator output supplies expected codes.
// @evidence contracts/testing.md#distinguishing-cases Ledger tombstones remain reserved, file/project companions deduplicate by their one public identity, contributors are allowed outside the built-in ledger, and every reported collision pair must resolve differently. A known no-var registration prevents an empty active registry from passing.
// @evidence contracts/testing.md#execution-ownership Live registration and public RuleCode resolution execute in one Go process; the ledger is compatibility data, not a file-presence or source-text oracle. No native artifact, installation or subprocess is needed.
func TestRuleCodesAreUniqueAcrossCompleteRegistry(t *testing.T) {
  ledgerCodes := make(map[int32]string, len(builtInRuleCodes))
  for name, code := range builtInRuleCodes {
    if code < rulecode.Minimum || code >= rulecode.MaximumExclusive {
      t.Fatalf("built-in rule %q has out-of-range code %d", name, code)
    }
    if previous, exists := ledgerCodes[code]; exists {
      t.Fatalf("built-in rules %q and %q share code %d", previous, name, code)
    }
    ledgerCodes[code] = name
  }
  fileRuleNames := AllRuleNames()
  if LookupRule("no-var") == nil || len(fileRuleNames) == 0 {
    t.Fatal("expected built-in no-var in a nonempty active registry")
  }
  for _, name := range fileRuleNames {
    if _, frozen := builtInRuleCodes[name]; frozen {
      continue
    }
    switch LookupRule(name).(type) {
    case contributorAdapter, formatContributorAdapter:
      // Runtime contributors are deliberately absent from the built-in ledger.
    default:
      t.Fatalf("active built-in rule %q is missing from rule_codes.json", name)
    }
  }

  allNames := append(fileRuleNames, allProjectRuleNames()...)
  sort.Strings(allNames)
  activeCodes := make(map[int32]string, len(allNames))
  seenNames := make(map[string]struct{}, len(allNames))
  for _, name := range allNames {
    // A built-in project companion is a second lifecycle for the same public
    // rule identity, so it must resolve to the same ledger entry rather than
    // count as a diagnostic-code collision with itself.
    if _, seen := seenNames[name]; seen {
      continue
    }
    seenNames[name] = struct{}{}
    code := RuleCode(name)
    if code < rulecode.Minimum || code >= rulecode.MaximumExclusive {
      t.Fatalf("active rule %q has out-of-range code %d", name, code)
    }
    if previous, exists := activeCodes[code]; exists {
      t.Fatalf("active rules %q and %q share code %d", previous, name, code)
    }
    activeCodes[code] = name
  }

  reportedCollisions := [][2]string{
    {"complexity", "vars-on-top"},
    {"format/declaration-header", "unicorn/prefer-array-some"},
    {"no-var", "typescript/no-this-alias"},
    {"regexp/no-useless-escape", "vitest/no-done-callback"},
    {"jsx-a11y/label-has-associated-control", "no-useless-rename"},
    {"no-alert", "no-unreachable"},
    {"no-sequences", "typescript/await-thenable"},
    {"jsx-a11y/no-distracting-elements", "unicorn/prefer-math-trunc"},
    {"functional/no-mixed-types", "object-shorthand"},
    {"typescript/no-unnecessary-type-constraint", "unicorn/no-typeof-undefined"},
    {"getter-return", "vitest/no-conditional-tests"},
  }
  for _, pair := range reportedCollisions {
    if left, right := RuleCode(pair[0]), RuleCode(pair[1]); left == right {
      t.Fatalf("formerly colliding rules %q and %q still share code %d", pair[0], pair[1], left)
    }
  }
}
