package evidence

import (
  "encoding/json"
  "testing"

  "github.com/samchon/ttsc/packages/lint/rule"
)

/**
 * Verifies nested severity accepts the public lint values and preserves absence.
 *
 * Off and inheritance cannot share a zero value. Null is an invalid level;
 * JavaScript undefined is omitted when options are serialized.
 *
 * 1. Decode the omitted value and every named or numeric severity.
 * 2. Reject null, booleans, objects, and unknown levels.
 * 3. Assert decoding distinguishes omission from explicit off.
  * @evidence contracts/testing.md#behavioral-verification decodeGraphSeverity returns each literal lint severity and exactly one diagnostic for invalid levels.
 * @evidence contracts/testing.md#independent-expectations All expected values and diagnostic fragments are literal contract expectations; no product decoder computes the expected answer.
 * @evidence contracts/testing.md#distinguishing-cases Omission must remain distinct from explicit off; named and numeric aliases contrast null, fractional, negative and unknown levels.
 * @evidence contracts/testing.md#execution-ownership This named decoder unit executes authored Go product functions in the semantic test process, without fixture installation, filesystem population, native plugin build or child process.
 */
func TestEvidenceSemanticConfigurationSeverityMatchesLintValues(t *testing.T) {
  absent, problems := decodeGraphSeverity(nil, "severity")
  if absent != nil || len(problems) != 0 {
    t.Fatalf("omission must inherit: %v %v", absent, problems)
  }
  for raw, want := range map[string]rule.Severity{
    `"off"`: rule.SeverityOff, `0`: rule.SeverityOff,
    `"warning"`: rule.SeverityWarn, `"warn"`: rule.SeverityWarn, `1`: rule.SeverityWarn,
    `"error"`: rule.SeverityError, `2`: rule.SeverityError, `2.0`: rule.SeverityError, `"err\u006fr"`: rule.SeverityError,
  } {
    got, problems := decodeGraphSeverity(json.RawMessage(raw), "severity")
    if len(problems) != 0 || got == nil || *got != want {
      t.Fatalf("%s: got %v %v", raw, got, problems)
    }
  }
  for _, raw := range []string{`null`, `true`, `{}`, `[]`, `"fatal"`, `""`, `3`, `-1`, `1.5`} {
    if _, problems := decodeGraphSeverity(json.RawMessage(raw), "severity"); len(problems) != 1 {
      t.Fatalf("accepted invalid level %s", raw)
    }
  }
}
