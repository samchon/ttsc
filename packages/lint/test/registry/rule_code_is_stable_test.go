package linthost

import (
	"fmt"
	"sort"
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
func TestInitialRuleCodeAssignmentShieldRejectsMutation(t *testing.T) {
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
		mutated[name] = code + 1
		if err := validateInitialRuleCodeAssignments(mutated); err == nil {
			t.Fatalf("initial noncollision mutation for %q was accepted", name)
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
	for _, name := range allNames {
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
