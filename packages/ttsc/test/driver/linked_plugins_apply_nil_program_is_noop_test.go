package driver_test

import (
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestDriverLinkedPluginsApplyNilProgramIsNoop verifies that applying linked
// plugins to a nil Program is a no-op.
//
// The public method is intentionally defensive so callers can defer cleanup or
// error-path plugin application without extra nil guards.
//
// 1. Declare a nil Program pointer.
// 2. Call ApplyLinkedPlugins.
// 3. Assert no error is returned.
func TestDriverLinkedPluginsApplyNilProgramIsNoop(t *testing.T) {
  var prog *driver.Program
  if err := prog.ApplyLinkedPlugins(); err != nil {
    t.Fatal(err)
  }
}
