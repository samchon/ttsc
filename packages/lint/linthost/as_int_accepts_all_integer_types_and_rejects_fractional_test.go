package linthost

import (
  "encoding/json"
  "strings"
  "testing"
)

// TestAsIntAcceptsAllIntegerTypesAndRejectsFractional checks the supported
// int, int32 and int64 forms, integral float64 and integer json.Number.
// It does not certify acceptance of every Go integer type.
//
// Independent literals 80 and 100 check preserved values. Fractional
// float64, fractional JSON number text and a string must be rejected;
// the fractional float error must also include the supplied field label.
// This direct fixture does not exercise JSON file loading or prove
// overflow behavior for values outside the tested range.
//
// @evidence contracts/testing.md#behavioral-verification asInt converts int(80), int32(80), int64(100), integral float64(80), and integer json.Number(80), but rejects fractional float64, fractional json.Number and string input; the fractional float error also names its field.
// @evidence contracts/testing.md#independent-expectations An integer config option preserves exact integer values and rejects fractional or nonnumeric representations; authored 80 and 100 literals supply expectations without using the conversion helper.
// @evidence contracts/testing.md#distinguishing-cases Owns three native integer forms, integral float and JSON text, two fractional representations, and unsupported string, contrasting accepted numeric representations with truncation and coercion defects.
// @evidence contracts/testing.md#execution-ownership This discoverable Go unit calls asInt directly on native numbers, authored json.Number values and a string in the shared lint test process; its returned values and errors require neither JSON file loading nor a child compiler.
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
  for _, input := range []any{int(80), float64(80)} {
    got, err := asInt("field", input)
    if err != nil || got != 80 {
      t.Fatalf("integer-valued %T input: value=%d error=%v", input, got, err)
    }
  }
}
