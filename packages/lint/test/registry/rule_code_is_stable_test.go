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
// A built-in moves away from its historical hash only when that preferred code
// is already occupied by another frozen assignment.
//
//  1. Require every active built-in to exist in the ledger.
//  2. Assert ledger and complete loaded registry codes are unique and in range.
//  3. Pin compatibility for noncolliding rules and all formerly colliding pairs.
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
	for name, code := range builtInRuleCodes {
		legacy := rulecode.Legacy(name)
		if code != legacy {
			if occupant, exists := ledgerCodes[legacy]; !exists {
				t.Fatalf("built-in rule %q moved from unused legacy code %d to %d", name, legacy, code)
			} else if occupant == name {
				t.Fatalf("built-in rule %q has inconsistent legacy assignment %d", name, legacy)
			}
		}
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

	formerlyColliding := [][2]string{
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
	for _, pair := range formerlyColliding {
		if left, right := RuleCode(pair[0]), RuleCode(pair[1]); left == right {
			t.Fatalf("formerly colliding rules %q and %q still share code %d", pair[0], pair[1], left)
		}
	}
}
