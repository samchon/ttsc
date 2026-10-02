package driver_test

import (
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestDriverRegisterPluginRejectsNil Verifies that RegisterPlugin(nil) immediately panics.
//
// Only panic presence is checked, without message or typed-nil coverage.
//
// 1. Reset the linked plugin registry.
// 2. Call RegisterPlugin(nil).
// 3. Assert a panic is raised.
//
// @evidence contracts/testing.md#behavioral-verification RegisterPlugin(nil) immediately panics.
// @evidence contracts/testing.md#independent-expectations Nil registration violates the public precondition before any Program load.
// @evidence contracts/testing.md#distinguishing-cases Only panic presence is checked, without message or typed-nil coverage.
// @evidence contracts/testing.md#execution-ownership The entry resets the registry and calls the public Go registration operation directly. Go discovers TestDriverRegisterPluginRejectsNil under ./test/driver.
func TestDriverRegisterPluginRejectsNil(t *testing.T) {
  resetLinkedPluginRegistry()
  defer func() {
    if recover() == nil {
      t.Fatal("RegisterPlugin(nil) did not panic")
    }
  }()
  driver.RegisterPlugin(nil)
}
