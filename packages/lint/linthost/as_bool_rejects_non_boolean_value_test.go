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
//  6. Supply false and require successful preservation rather than a truthy default.
//
// @evidence contracts/testing.md#behavioral-verification asBool rejects string true with the offending field name and accepts Boolean true and false without changing their values.
// @evidence contracts/testing.md#independent-expectations Boolean option fields require actual bool values rather than truthy string coercion; the literal true result and field identity supply independent expectations.
// @evidence contracts/testing.md#distinguishing-cases Owns a misleading string true and both actual Boolean values across format fields; format-block tests separately exercise the caller field validation.
// @evidence contracts/testing.md#execution-ownership This discoverable Go unit calls asBool directly on three authored values in the shared lint test process; it observes returned Booleans and errors without filesystem fixtures or a config script host.
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
  if got, err := asBool("format.semi", false); err != nil || got {
    t.Fatalf("asBool(field, false): value=%v error=%v", got, err)
  }
}
