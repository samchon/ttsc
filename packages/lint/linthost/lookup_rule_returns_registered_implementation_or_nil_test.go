package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

type lookupSentinelRule struct{ name string }

func (r *lookupSentinelRule) Name() string                  { return r.name }
func (r *lookupSentinelRule) Visits() []shimast.Kind        { return nil }
func (r *lookupSentinelRule) Check(*Context, *shimast.Node) {}

// TestLookupRuleReturnsRegisteredImplementationOrNil verifies LookupRule returns
// the exact implementation registered under a name and nil for a name that was
// never registered.
//
// The hit uses a sentinel the test registers itself, so the expectation is the
// pointer the test supplied rather than a production rule name.
//
//  1. Register a pointer-typed sentinel rule under a fresh name.
//  2. Look the name up and require the identical pointer.
//  3. Look up a second, never-registered name and require nil.
//
// @evidence contracts/testing.md#behavioral-verification LookupRule returns the identical pointer that Register stored for the sentinel name, and returns a nil Rule for an adjacent never-registered name instead of a placeholder.
// @evidence contracts/testing.md#independent-expectations The expected hit is the pointer the test constructed and registered; the expected miss is nil by the registry contract. Neither is derived from the production rule set or from LookupRule output.
// @evidence contracts/testing.md#distinguishing-cases One registered name and one unregistered neighbor distinguish a registry that returns anything for every name from one that returns nothing; duplicate registration and complete enumeration are owned by the duplicate-name and enumeration tests.
// @evidence contracts/testing.md#execution-ownership Unit entry TestLookupRuleReturnsRegisteredImplementationOrNil calls Register and LookupRule in the shared linthost test process with a private stub and removes the sentinel on cleanup; it checks no repository arrangement and starts no host.
func TestLookupRuleReturnsRegisteredImplementationOrNil(t *testing.T) {
  const hit = "test/lookup-sentinel"
  const miss = "test/lookup-never-registered"
  if LookupRule(hit) != nil || LookupRule(miss) != nil {
    t.Fatalf("sentinel names are already registered: %q, %q", hit, miss)
  }
  registeredRule := &lookupSentinelRule{name: hit}
  Register(registeredRule)
  t.Cleanup(func() {
    delete(registered.rules, hit)
    invalidateRuntimeRuleCodes()
  })

  if got := LookupRule(hit); got != Rule(registeredRule) {
    t.Fatalf("LookupRule(%q) = %v, want the registered pointer", hit, got)
  }
  if got := LookupRule(miss); got != nil {
    t.Fatalf("LookupRule(%q) = %v, want nil", miss, got)
  }
}
