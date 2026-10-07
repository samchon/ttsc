package linthost

import (
  "strings"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// duplicateGuardRule is a minimal rule type used solely by
// TestRegisterRejectsDuplicateRuleName to trip the duplicate-name panic
// guard in `Register`. Its `Name()` returns a stable id that does not
// collide with any built-in rule. The test owns both registrations and removes
// its sentinel at cleanup; no package-init registration of this stub is needed.
type duplicateGuardRule struct{ name string }

func (r duplicateGuardRule) Name() string                  { return r.name }
func (r duplicateGuardRule) Visits() []shimast.Kind        { return nil }
func (r duplicateGuardRule) Check(*Context, *shimast.Node) {}

// TestRegisterRejectsDuplicateRuleName verifies the duplicate-name panic
// branch in `Register`. A regression that accidentally removed the
// guard would let one rule shadow another silently — the first
// registration wins or loses depending on iteration order, and no test
// would notice.
//
//  1. Pick a sentinel rule name not used by any registered rule.
//  2. Register a stub rule under that name.
//  3. Register the same name again and assert that Register panics
//     with a message containing the rule name.
//  4. Require the original implementation to survive rejection and restore derived registry state.
//
// @evidence contracts/testing.md#behavioral-verification Register accepts a fresh sentinel implementation, rejects a second registration of its identity with a named panic, and LookupRule still returns the first implementation after that rejection.
// @evidence contracts/testing.md#independent-expectations The registry identity contract forbids silently replacing a registered rule; independent first-pointer identity, the authored sentinel name and a required panic establish acceptance, rejection and preservation.
// @evidence contracts/testing.md#distinguishing-cases Owns unique-name acceptance followed by duplicate-name rejection and original-instance preservation; Nil registration is outside this duplicate-identity scenario. Cleanup removes the sentinel and invalidates derived diagnostic codes to avoid leaking mutable registry state.
// @evidence contracts/testing.md#execution-ownership TestRegisterRejectsDuplicateRuleName runs Register and LookupRule directly in the shared Go unit process with a private rule stub, serial registration and cleanup; no consumer, compilation or real product host is involved.
func TestRegisterRejectsDuplicateRuleName(t *testing.T) {
  name := "test/duplicate-guard-sentinel"
  for _, existing := range AllRuleNames() {
    if existing == name {
      t.Fatalf("sentinel name %q collides with an existing rule; pick a new sentinel", name)
    }
  }
  first := &duplicateGuardRule{name: name}
  Register(first)
  if LookupRule(name) != first {
    t.Fatal("first registration did not retain its implementation")
  }
  t.Cleanup(func() {
    // Allow re-running the test by removing the sentinel from the
    // registry. Using package-private state is acceptable because this
    // file lives inside the linthost package's test binary.
    delete(registered.rules, name)
    invalidateRuntimeRuleCodes()
  })

  defer func() {
    r := recover()
    if r == nil {
      t.Fatal("second Register did not panic on duplicate name")
    }
    if LookupRule(name) != first {
      t.Error("rejected duplicate replaced the first implementation")
    }
    msg, ok := r.(string)
    if !ok {
      t.Fatalf("panic value is %T, want string: %v", r, r)
    }
    if !strings.Contains(msg, name) {
      t.Errorf("panic message %q does not mention the duplicate rule name %q", msg, name)
    }
  }()
  Register(duplicateGuardRule{name: name})
}
