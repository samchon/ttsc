package driver_test

import (
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestDriverLinkedPluginsApplyNilProgramIsNoop Verifies that ApplyLinkedPlugins returns nil for a nil Program.
//
// Only the nil branch is asserted; non-nil hook execution belongs to other linked-plugin cases.
//
// 1. Declare a nil Program pointer.
// 2. Call ApplyLinkedPlugins.
// 3. Assert no error is returned.
//
// @evidence contracts/testing.md#behavioral-verification ApplyLinkedPlugins returns nil for a nil Program.
// @evidence contracts/testing.md#independent-expectations The defensive nil-receiver contract requires a no-op rather than a panic.
// @evidence contracts/testing.md#distinguishing-cases Only the nil branch is asserted; non-nil hook execution belongs to other linked-plugin cases.
// @evidence contracts/testing.md#execution-ownership This entry directly calls the public method on a nil pointer in Go. Go discovers TestDriverLinkedPluginsApplyNilProgramIsNoop under ./test/driver.
func TestDriverLinkedPluginsApplyNilProgramIsNoop(t *testing.T) {
  var prog *driver.Program
  if err := prog.ApplyLinkedPlugins(); err != nil {
    t.Fatal(err)
  }
}
