package linthost

import (
  "encoding/json"
  "strings"
  "testing"
)

// TestAsIntAcceptsAllIntegerTypesAndRejectsFractional verifies asInt coerces
// int, int32, int64, integer-valued float64, and json.Number correctly, and
// rejects fractional float64, non-integer json.Number, and invalid types.
//
// Locks six arms of the asInt type switch plus the error fallthrough:
//
//   - int (already covered by existing tests via the engine path).
//
//   - int32: must convert to int without error.
//
//   - int64: must convert to int without error.
//
//   - float64 integer-valued: must coerce (existing coverage covers this).
//
//   - float64 fractional: must fall through to the error return.
//
//   - json.Number valid integer: must coerce via Int64.
//
//   - json.Number fractional: must fall through to the error return.
//
//   - unsupported type (string): must return the error.
//
//     1. Call asInt with an int32 value — assert success and correct result.
//     2. Call asInt with an int64 value — assert success and correct result.
//     3. Call asInt with float64(3.7) — assert error (fractional).
//     4. Call asInt with json.Number("80") — assert success.
//     5. Call asInt with json.Number("3.5") — assert error (fractional).
//     6. Call asInt with a string — assert error.
func TestAsIntAcceptsAllIntegerTypesAndRejectsFractional(t *testing.T) {
  // int32 arm.
  got, err := asInt("field", int32(80))
  if err != nil {
    t.Fatalf("asInt(int32(80)): unexpected error: %v", err)
  }
  if got != 80 {
    t.Fatalf("asInt(int32(80)): want 80, got %d", got)
  }

  // int64 arm.
  got, err = asInt("field", int64(100))
  if err != nil {
    t.Fatalf("asInt(int64(100)): unexpected error: %v", err)
  }
  if got != 100 {
    t.Fatalf("asInt(int64(100)): want 100, got %d", got)
  }

  // float64 fractional — must error.
  _, err = asInt("field", float64(3.7))
  if err == nil {
    t.Fatal("asInt(float64(3.7)): expected error for fractional, got nil")
  }
  if !strings.Contains(err.Error(), "field") {
    t.Errorf("asInt error should name the field, got: %v", err)
  }

  // json.Number integer — must succeed.
  got, err = asInt("field", json.Number("80"))
  if err != nil {
    t.Fatalf("asInt(json.Number(\"80\")): unexpected error: %v", err)
  }
  if got != 80 {
    t.Fatalf("asInt(json.Number(\"80\")): want 80, got %d", got)
  }

  // json.Number fractional — must error.
  _, err = asInt("field", json.Number("3.5"))
  if err == nil {
    t.Fatal("asInt(json.Number(\"3.5\")): expected error, got nil")
  }

  // Unsupported type — must error.
  _, err = asInt("field", "eighty")
  if err == nil {
    t.Fatal("asInt(string): expected error, got nil")
  }
}
