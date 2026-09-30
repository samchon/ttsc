package linthost

import (
  "reflect"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

type runtimeRuleCodeTestRule struct{ name string }

func (rule runtimeRuleCodeTestRule) Name() string             { return rule.name }
func (runtimeRuleCodeTestRule) Visits() []shimast.Kind        { return nil }
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
//
// @evidence contracts/testing.md#behavioral-verification Live RuleCode resolves a synthetic colliding file/project rule pair to distinct reserved-band codes that do not reuse any built-in reservation, with identical mappings after reversed insertion order.
// @evidence contracts/testing.md#independent-expectations Different public rule identities must receive different codes in literal [9000,18000), all frozen built-in codes remain reserved, and unchanged membership determines registration-order independence. The second run is an ordering control, not an oracle for absolute code assignments.
// @evidence contracts/testing.md#distinguishing-cases The original colliding pair spans public Register for the file rule and a directly populated project-rule adapter; both insertion orders and every built-in reservation are checked. Explicit band checks reject absent/default-zero assignments, and cleanup invalidates the cache between populations.
// @evidence contracts/testing.md#execution-ownership The actual file/project registries and public RuleCode resolver run in one Go process, using synthetic collision names only as inputs. This unit owns live allocator integration; contributor producer/linkage and full project-rule registration are not claimed, and no native build, install or subprocess executes.
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
  for _, name := range []string{left, right} {
    if code := forward[name]; code < 9000 || code >= 18000 {
      t.Fatalf("runtime code for %q outside reserved band: %d", name, code)
    }
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
