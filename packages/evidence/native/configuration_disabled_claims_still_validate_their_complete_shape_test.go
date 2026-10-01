package evidence

import (
  "encoding/json"
  "strings"
  "testing"
)

/**
 * Verifies disabling a claim never conceals a malformed public shape.
 *
 * `disabled` is an evaluation gate, not an escape from configuration
 * integrity. Filtering during decoding would let staged claims accumulate
 * misspelled fields and absent obligations that fail only when enabled.
 *
 *  1. Disable a claim with an unknown property and missing required fields.
 *  2. Decode the complete public shape.
 *  3. Assert every independent structural failure is still reported.
 *
 * @evidence contracts/testing.md#behavioral-verification decodeGraphConfig reports every independently named malformed structural field even on a disabled claim.
 *
 * @evidence contracts/testing.md#independent-expectations Disabled controls graph activation after decoding; it cannot authorize an unknown legacyFiles key or absent files/reference. All three literal structural paths must still report.
 *
 * @evidence contracts/testing.md#distinguishing-cases The disabled gate must not conceal an unknown property, absent files or absent reference.
 *
 * @evidence contracts/testing.md#execution-ownership TestEvidenceSemanticDisabledClaimsStillValidateTheirCompleteShape is a Go unit entry in the native test process; it calls decodeGraphConfig on one in-memory JSON string with no filesystem, package installation, artifact build or product host, and loops over three expected message fragments rather than a table of variants.
 */
func TestEvidenceSemanticDisabledClaimsStillValidateTheirCompleteShape(t *testing.T) {
  _, problems := decodeGraphConfig(json.RawMessage(`{"claims":[{
    "type":"typescript",
    "disabled":true,
    "legacyFiles":["src/**"]
  }]}`))
  joined := strings.Join(problems, "\n")
  for _, expected := range []string{
    "claims[0].legacyFiles: unknown property",
    "claims[0].files: the required project-relative glob array is missing",
    "claims[0].reference: the required evidence reference is missing",
  } {
    if !strings.Contains(joined, expected) {
      t.Fatalf("expected %q, got:\n%s", expected, joined)
    }
  }
}
