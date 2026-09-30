package linthost

import (
  "testing"

  "github.com/samchon/ttsc/packages/lint/rule"
)

// TestSeverityConstantsMatchInternalEngine pins the integer values of
// the public `rule.SeverityX` constants against the engine-internal
// `linthost.SeverityX` constants.
//
// The contributor adapter casts `linthost.Severity` to `rule.Severity`
// unchecked (contrib_adapter.go), so reordering either side silently
// misroutes contributor severities (a `warn` would dispatch as `error`,
// etc.). A constant-link test fails the build the moment either set
// drifts, replacing the silent miscast with a compile-and-test error.
//
// 1. Read the three public `rule.SeverityX` constants.
// 2. Read the three internal `linthost.SeverityX` constants.
// 3. Require both sides to equal the independent protocol values off=0, warn=1, error=2.
// 4. Preserve the pairwise adapter compatibility assertion.
//
// @evidence contracts/testing.md#behavioral-verification Both public contributor and internal host severity constants equal the protocol ordinals 0, 1 and 2, and each unchecked adapter cast remains value-compatible.
// @evidence contracts/testing.md#independent-expectations The documented off/warn/error ordinal protocol supplies literal 0/1/2 expectations; checking both declarations against these values detects synchronized drift that pairwise equality alone cannot.
// @evidence contracts/testing.md#distinguishing-cases Owns all three severity levels and both sides of the adapter boundary; report suppression and warning/error command effects are exercised by the public context and command suites.
// @evidence contracts/testing.md#execution-ownership TestSeverityConstantsMatchInternalEngine is one selected Go unit entry reading supported protocol constants in-process; it verifies a defined constant contract, without inspecting committed source, installing a consumer or starting a host.
func TestSeverityConstantsMatchInternalEngine(t *testing.T) {
  cases := []struct {
    name     string
    public   rule.Severity
    internal Severity
    expected int
  }{
    {"off", rule.SeverityOff, SeverityOff, 0},
    {"warn", rule.SeverityWarn, SeverityWarn, 1},
    {"error", rule.SeverityError, SeverityError, 2},
  }
  for _, tc := range cases {
    if int(tc.public) != tc.expected || int(tc.internal) != tc.expected {
      t.Errorf("severity %q: public=%d internal=%d, want protocol value %d", tc.name, tc.public, tc.internal, tc.expected)
    }
    if int(tc.public) != int(tc.internal) {
      t.Errorf("severity %q drift: rule.Severity%v=%d, linthost.Severity%v=%d",
        tc.name, tc.public, int(tc.public), tc.internal, int(tc.internal))
    }
  }
}
