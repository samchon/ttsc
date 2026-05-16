package driver_test

import (
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPEnvelopeRejectsMalformedJSON pins the JSON error wrapping. The
// proxy forwards malformed frames verbatim — that path only fires when
// ParseEnvelope returns an error, so the error surface must be stable.
//
// 1. Pass non-JSON bytes to ParseEnvelope.
// 2. Assert an error mentioning "envelope" is returned.
func TestLSPEnvelopeRejectsMalformedJSON(t *testing.T) {
  _, err := driver.ParseEnvelope([]byte("not json"))
  if err == nil {
    t.Fatal("expected envelope decode error")
  }
  if !strings.Contains(err.Error(), "envelope") {
    t.Fatalf("error should mention envelope: %v", err)
  }
}
