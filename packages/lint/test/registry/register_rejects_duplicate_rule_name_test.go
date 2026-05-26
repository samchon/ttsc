package linthost

import (
  "strings"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// duplicateGuardRule is a minimal rule type used solely by
// TestRegisterRejectsDuplicateRuleName to trip the duplicate-name panic
// guard in `Register`. Its `Name()` returns a stable id that does not
// collide with any built-in rule. A real registration of this struct
// happens in `init()` (one per package — running `go test` re-uses that
// registration), so the test re-registers under a derived name that is
// guaranteed to be unique-then-duplicated within a single test body.
type duplicateGuardRule struct{ name string }

func (r duplicateGuardRule) Name() string           { return r.name }
func (r duplicateGuardRule) Visits() []shimast.Kind { return nil }
func (r duplicateGuardRule) Check(*Context, *shimast.Node) {}

// TestRegisterRejectsDuplicateRuleName pins the duplicate-name panic
// branch in `Register`. A regression that accidentally removed the
// guard would let one rule shadow another silently — the first
// registration wins or loses depending on iteration order, and no test
// would notice.
//
//  1. Pick a sentinel rule name not used by any registered rule.
//  2. Register a stub rule under that name.
//  3. Register the same name again and assert that Register panics
//     with a message containing the rule name.
func TestRegisterRejectsDuplicateRuleName(t *testing.T) {
  name := "test/duplicate-guard-sentinel"
  for _, existing := range AllRuleNames() {
    if existing == name {
      t.Fatalf("sentinel name %q collides with an existing rule; pick a new sentinel", name)
    }
  }
  Register(duplicateGuardRule{name: name})
  t.Cleanup(func() {
    // Allow re-running the test by removing the sentinel from the
    // registry. Using package-private state is acceptable because this
    // file lives inside the linthost package's test binary.
    delete(registered.rules, name)
  })

  defer func() {
    r := recover()
    if r == nil {
      t.Fatal("second Register did not panic on duplicate name")
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
