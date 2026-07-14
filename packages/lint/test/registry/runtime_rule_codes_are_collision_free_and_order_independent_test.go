package linthost

import (
	"reflect"
	"testing"

	shimast "github.com/microsoft/typescript-go/shim/ast"
)

type runtimeRuleCodeTestRule struct{ name string }

func (rule runtimeRuleCodeTestRule) Name() string           { return rule.name }
func (runtimeRuleCodeTestRule) Visits() []shimast.Kind      { return nil }
func (runtimeRuleCodeTestRule) Check(*Context, *shimast.Node) {}

// TestRuntimeRuleCodesAreCollisionFreeAndOrderIndependent verifies contributed
// rules reach the same complete-set allocator as built-in diagnostics.
//
// Contributor names are not frozen in the package ledger because the host does
// not control their installed set. For one unchanged set, however, registration
// order must not affect codes and a legacy hash collision must never leak into
// the native diagnostic stream, including across file and project rules.
//
//  1. Insert a synthetic colliding file/project contributor pair in forward order.
//  2. Reinsert the same pair in reverse order and compare assignments.
//  3. Require both mappings to remain distinct from each other and built-ins.
func TestRuntimeRuleCodesAreCollisionFreeAndOrderIndependent(t *testing.T) {
	left, right := findSyntheticRuleCodeCollision(t)
	_, leftProject := registeredProjectRules[left]
	_, rightProject := registeredProjectRules[right]
	if LookupRule(left) != nil || LookupRule(right) != nil || leftProject || rightProject {
		t.Fatalf("synthetic contributor names unexpectedly registered: %q, %q", left, right)
	}
	forward := runtimeCodesForInsertionOrder(t, left, right, []string{left, right})
	reverse := runtimeCodesForInsertionOrder(t, left, right, []string{right, left})
	if !reflect.DeepEqual(forward, reverse) {
		t.Fatalf("runtime codes depend on registration order: forward=%#v reverse=%#v", forward, reverse)
	}
	if forward[left] == forward[right] {
		t.Fatalf("runtime collision for %q and %q at %d", left, right, forward[left])
	}
	for builtInName, builtInCode := range builtInRuleCodes {
		if forward[left] == builtInCode || forward[right] == builtInCode {
			t.Fatalf("runtime code overlaps built-in %q at %d", builtInName, builtInCode)
		}
	}
}

func runtimeCodesForInsertionOrder(t *testing.T, fileName string, projectName string, names []string) map[string]int32 {
	t.Helper()
	for _, name := range names {
		if name == fileName {
			Register(runtimeRuleCodeTestRule{name: name})
			continue
		}
		registeredProjectRules[name] = projectRuleAdapter{name: name}
		invalidateRuntimeRuleCodes()
	}
	defer func() {
		delete(registered.rules, fileName)
		delete(registeredProjectRules, projectName)
		invalidateRuntimeRuleCodes()
	}()
	codes := make(map[string]int32, len(names))
	for _, name := range names {
		codes[name] = RuleCode(name)
	}
	return codes
}
