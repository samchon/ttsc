package driver_test

import (
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestDriverRegisterPluginRejectsNil verifies nil plugin registrations panic
// immediately.
//
// Linked packages register from init(), so accepting nil would move the failure
// to a later Program load where the broken package is harder to identify.
//
// 1. Reset the linked plugin registry.
// 2. Call RegisterPlugin(nil).
// 3. Assert a panic is raised.
func TestDriverRegisterPluginRejectsNil(t *testing.T) {
  resetLinkedPluginRegistry()
  defer func() {
    if recover() == nil {
      t.Fatal("RegisterPlugin(nil) did not panic")
    }
  }()
  driver.RegisterPlugin(nil)
}
