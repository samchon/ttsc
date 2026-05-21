package linthost

import (
  "strings"
  "testing"
)

// TestAsBoolRejectsNonBooleanValue verifies asBool returns a typed error when
// given a value that is not a Go bool.
//
// Locks the error return path inside asBool. The function is the primary
// boolean coercion helper for every format-block boolean field; when a caller
// provides a non-bool (e.g. a string), asBool must return an error with the
// field name in the message so the user can trace the misconfiguration.
//
//  1. Call asBool("format.semi", "true") — string value, not bool.
//  2. Assert an error is returned.
//  3. Assert the error message names the offending field.
//  4. Call asBool("format.useTabs", true) — valid bool.
//  5. Assert no error and the returned value is true.
func TestAsBoolRejectsNonBooleanValue(t *testing.T) {
  _, err := asBool("format.semi", "true")
  if err == nil {
    t.Fatal("asBool(field, string): expected error, got nil")
  }
  if !strings.Contains(err.Error(), "format.semi") {
    t.Errorf("asBool error should name the field, got: %v", err)
  }

  got, err := asBool("format.useTabs", true)
  if err != nil {
    t.Fatalf("asBool(field, true): unexpected error: %v", err)
  }
  if !got {
    t.Fatal("asBool(field, true): expected true, got false")
  }
}
