package linthost

import (
	"sort"
	"testing"

	"github.com/samchon/ttsc/packages/lint/internal/rulecode"
)

// This fixture records only collisions present when the ledger was introduced.
// Future collisions must rely on the append-only ledger instead of being added
// here, because a later name may sort before the historical incumbent.
var initialRuleCodeMigrationCollisions = [21]struct {
	incumbent     string
	displaced     string
	displacedCode int32
}{
	{"react/no-direct-mutation-state", "regexp/require-unicode-regexp", 9037},
	{"no-loss-of-precision", "playwright/no-hooks", 9082},
	{"typescript/no-unnecessary-type-constraint", "unicorn/no-typeof-undefined", 9275},
	{"getter-return", "vitest/no-conditional-tests", 9584},
	{"complexity", "vars-on-top", 10346},
	{"jsdoc/check-values", "no-bitwise", 10529},
	{"no-obj-calls", "react/jsx-no-script-url", 11455},
	{"format/declaration-header", "unicorn/prefer-array-some", 11818},
	{"no-var", "typescript/no-this-alias", 11967},
	{"solid/prefer-for", "unicorn/no-useless-undefined", 12738},
	{"regexp/no-useless-escape", "vitest/no-done-callback", 13468},
	{"jsx-a11y/label-has-associated-control", "no-useless-rename", 13516},
	{"no-alert", "no-unreachable", 13730},
	{"no-sequences", "typescript/await-thenable", 14106},
	{"testing-library/no-wait-for-snapshot", "unicorn/prefer-dom-node-text-content", 14576},
	{"playwright/no-wait-for-navigation", "unicorn/no-useless-error-capture-stack-trace", 14878},
	{"react/no-danger-with-children", "unicorn/prefer-string-replace-all", 14980},
	{"jsx-a11y/no-distracting-elements", "unicorn/prefer-math-trunc", 14993},
	{"regexp/no-dupe-characters-character-class", "security/detect-non-literal-regexp", 16372},
	{"functional/no-mixed-types", "object-shorthand", 16865},
	{"jsx-a11y/heading-has-content", "solid/jsx-no-duplicate-props", 17486},
}

// TestRuleCodesAreUniqueAcrossCompleteRegistry verifies the frozen built-in
// ledger and every loaded runtime rule occupy one collision-free code space.
//
// The ledger is the compatibility contract: existing entries, including
// tombstones for removed rules, must remain unique and in the TS-style band.
// The initial migration collisions are frozen separately so future rules may
// join a legacy collision group without redefining its original incumbent.
//
//  1. Require every active built-in to exist in the ledger.
//  2. Assert ledger and complete loaded registry codes are unique and in range.
//  3. Pin the initial migration incumbents and every pair reported in #492.
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
	for _, collision := range initialRuleCodeMigrationCollisions {
		legacy := rulecode.Legacy(collision.incumbent)
		if displacedLegacy := rulecode.Legacy(collision.displaced); displacedLegacy != legacy {
			t.Fatalf("invalid initial migration fixture %q/%q: %d != %d", collision.incumbent, collision.displaced, legacy, displacedLegacy)
		}
		if code, exists := builtInRuleCodes[collision.incumbent]; !exists || code != legacy {
			t.Fatalf("initial migration incumbent %q changed from %d to %d (exists=%t)", collision.incumbent, legacy, code, exists)
		}
		if code, exists := builtInRuleCodes[collision.displaced]; !exists || code != collision.displacedCode {
			t.Fatalf("initial migration collision loser %q changed from %d to %d (exists=%t)", collision.displaced, collision.displacedCode, code, exists)
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
