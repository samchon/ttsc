package ttsc_test

import (
  "strings"
  "testing"
)

// TestCLICommandDemoRejectsUnknownType verifies invalid demo type names fail
// through the command front door.
//
// The demo command accepts a deliberately small atomic-type set. Unknown
// values should produce a usage-grade command error instead of a successful
// fallback predicate.
//
// 1. Execute `demo` with an unsupported `--type` value.
// 2. Assert the native command exits with code 2.
// 3. Assert stderr names the bad demo type flag.
func TestCLICommandDemoRejectsUnknownType(t *testing.T) {
  code, out, errOut := runNativeCommand(t, "demo", "--type=object")
  if code != 2 {
    t.Fatalf("unknown demo type should fail: code=%d stdout=%q stderr=%q", code, out, errOut)
  }
  if !strings.Contains(errOut, "unknown --type") {
    t.Fatalf("unknown demo type diagnostic missing flag name: %q", errOut)
  }
}
