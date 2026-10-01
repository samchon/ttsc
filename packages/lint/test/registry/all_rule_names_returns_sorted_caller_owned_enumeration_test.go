package linthost

import (
  "reflect"
  "sort"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

type enumerationSentinelRule struct{ name string }

func (r enumerationSentinelRule) Name() string                  { return r.name }
func (r enumerationSentinelRule) Visits() []shimast.Kind        { return nil }
func (r enumerationSentinelRule) Check(*Context, *shimast.Node) {}

// TestAllRuleNamesReturnsSortedCallerOwnedEnumeration verifies AllRuleNames lists
// registered identities in lexical order and hands the caller a slice it owns.
//
// Two sentinel rules are registered in reverse lexical order so the expected
// positions come from the names the test chose, not from the production rule
// set. The caller then overwrites its slice, and a second enumeration must be
// unaffected.
//
//  1. Register a "zz" sentinel and then an "aa" sentinel.
//  2. Enumerate and require the whole result to be sorted with "aa" before "zz".
//  3. Overwrite the first element of the result and enumerate again.
//
// @evidence contracts/testing.md#behavioral-verification AllRuleNames runs against the live registry after two sentinel registrations made in reverse lexical order; the result must be sorted, contain each sentinel exactly once with the aa sentinel ahead of the zz sentinel, and a fresh enumeration after the caller overwrote element zero must equal the first result.
// @evidence contracts/testing.md#independent-expectations The expected relative order is fixed by the two sentinel names chosen in the test (test/enumeration-aa before test/enumeration-zz) and by sort.StringsAreSorted, not by reading names out of the production rule set; no production rule name is asserted to exist.
// @evidence contracts/testing.md#distinguishing-cases Reverse-order registration distinguishes sorted output from insertion order, and the post-mutation enumeration distinguishes a caller-owned copy from a shared backing slice. Lookup of single names is owned by the register and lookup tests.
// @evidence contracts/testing.md#execution-ownership Unit entry TestAllRuleNamesReturnsSortedCallerOwnedEnumeration calls Register and AllRuleNames in the shared linthost test process with a private rule stub, deleting the sentinels and invalidating derived rule codes on cleanup; it reads no manifest, document or source text and starts no host.
func TestAllRuleNamesReturnsSortedCallerOwnedEnumeration(t *testing.T) {
  const (
    first  = "test/enumeration-zz"
    second = "test/enumeration-aa"
  )
  for _, name := range []string{first, second} {
    if LookupRule(name) != nil {
      t.Fatalf("sentinel name %q is already registered", name)
    }
    Register(enumerationSentinelRule{name: name})
    name := name
    t.Cleanup(func() {
      delete(registered.rules, name)
      invalidateRuntimeRuleCodes()
    })
  }

  names := AllRuleNames()
  if !sort.StringsAreSorted(names) {
    t.Fatalf("AllRuleNames is not sorted: %v", names)
  }
  positions := map[string]int{}
  for index, name := range names {
    if _, duplicate := positions[name]; duplicate {
      t.Fatalf("AllRuleNames lists %q twice", name)
    }
    positions[name] = index
  }
  aa, hasAA := positions[second]
  zz, hasZZ := positions[first]
  if !hasAA || !hasZZ || aa >= zz {
    t.Fatalf("sentinel order wrong: %q at %d (present=%v), %q at %d (present=%v)", second, aa, hasAA, first, zz, hasZZ)
  }

  snapshot := append([]string(nil), names...)
  names[0] = "caller-owned-slice-mutation"
  if again := AllRuleNames(); !reflect.DeepEqual(again, snapshot) {
    t.Fatalf("caller mutation changed a later enumeration: %v != %v", again, snapshot)
  }
}
