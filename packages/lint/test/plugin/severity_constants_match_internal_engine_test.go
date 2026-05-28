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
// 3. Assert each pair has the same int value.
func TestSeverityConstantsMatchInternalEngine(t *testing.T) {
	cases := []struct {
		name     string
		public   rule.Severity
		internal Severity
	}{
		{"off", rule.SeverityOff, SeverityOff},
		{"warn", rule.SeverityWarn, SeverityWarn},
		{"error", rule.SeverityError, SeverityError},
	}
	for _, tc := range cases {
		if int(tc.public) != int(tc.internal) {
			t.Errorf("severity %q drift: rule.Severity%v=%d, linthost.Severity%v=%d",
				tc.name, tc.public, int(tc.public), tc.internal, int(tc.internal))
		}
	}
}
