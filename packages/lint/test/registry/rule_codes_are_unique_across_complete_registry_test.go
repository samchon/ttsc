package linthost

import (
  "sort"
  "testing"
  "github.com/samchon/ttsc/packages/lint/internal/rulecode"
)

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
//  3. Pin every pair reported in #492; the separate initial-assignment units
//     freeze the original published ledger values.
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
