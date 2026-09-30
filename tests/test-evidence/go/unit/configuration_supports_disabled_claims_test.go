package evidence

import (
  "encoding/json"
  "strings"
  "testing"
)

/**
 * Verifies staged activation defaults to enabled and accepts only a JSON
 * boolean.
 *
 * Runtime configuration can bypass the public TypeScript interface, so the
 * decoder must distinguish `true` and `false` from values that merely look
 * truthy. The original array indexes must survive the decoded model because
 * later diagnostics use them as the claim identity.
 *
 *  1. Decode omitted, explicit-false, and explicit-true claims.
 *  2. Assert their activation state and original indexes.
 *  3. Reject every representative non-boolean value.
  * @evidence contracts/testing.md#behavioral-verification decodeGraphConfig preserves three literal activation states and original indexes and rejects non-booleans.
 * @evidence contracts/testing.md#independent-expectations All expected values and diagnostic fragments are literal contract expectations; no product decoder computes the expected answer.
 * @evidence contracts/testing.md#distinguishing-cases Omitted, explicit false and explicit true contrast string, number, null, object and array input.
 * @evidence contracts/testing.md#execution-ownership This named decoder unit executes authored Go product functions in the semantic test process, without fixture installation, filesystem population, native plugin build or child process.
 */
func TestEvidenceSemanticDisabledClaimsDefaultToEnabledAndRequireABoolean(t *testing.T) {
  config, problems := decodeGraphConfig(json.RawMessage(`{"claims":[
    {
      "type":"typescript",
      "files":["src/first.ts"],
      "reference":{"type":"markdown","files":["docs/first.md"]}
    },
    {
      "type":"typescript",
      "disabled":false,
      "files":["src/second.ts"],
      "reference":{"type":"markdown","files":["docs/second.md"]}
    },
    {
      "type":"typescript",
      "disabled":true,
      "files":["src/third.ts"],
      "reference":{"type":"markdown","files":["docs/third.md"]}
    }
  ]}`))
  if len(problems) != 0 {
    t.Fatalf("unexpected decode diagnostics: %v", problems)
  }
  if len(config.Claims) != 3 {
    t.Fatalf("expected three decoded claims, got %d", len(config.Claims))
  }
  for index, claim := range config.Claims {
    if claim.Index != index {
      t.Fatalf("claim %d retained index %d", index, claim.Index)
    }
    wantDisabled := index == 2
    if claim.Disabled != wantDisabled {
      t.Fatalf("claim %d disabled = %t, want %t", index, claim.Disabled, wantDisabled)
    }
  }

  for _, value := range []string{`"true"`, `1`, `null`, `{}`, `[]`} {
    _, invalid := decodeGraphConfig(json.RawMessage(`{"claims":[{
      "type":"typescript",
      "disabled":` + value + `,
      "files":["src/index.ts"],
      "reference":{"type":"markdown","files":["docs/index.md"]}
    }]}`))
    if !strings.Contains(strings.Join(invalid, "\n"), "claims[0].disabled: expected a boolean") {
      t.Fatalf("disabled value %s was not rejected: %v", value, invalid)
    }
  }
}

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
  * @evidence contracts/testing.md#behavioral-verification decodeGraphConfig reports every independently named malformed structural field even on a disabled claim.
 * @evidence contracts/testing.md#independent-expectations All expected values and diagnostic fragments are literal contract expectations; no product decoder computes the expected answer.
 * @evidence contracts/testing.md#distinguishing-cases The disabled gate must not conceal an unknown property, absent files or absent reference.
 * @evidence contracts/testing.md#execution-ownership This named decoder unit executes authored Go product functions in the semantic test process, without fixture installation, filesystem population, native plugin build or child process.
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
