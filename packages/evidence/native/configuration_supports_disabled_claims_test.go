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
 *
 * @evidence contracts/testing.md#behavioral-verification decodeGraphConfig preserves three literal activation states and original indexes and rejects non-booleans.
 *
 * @evidence contracts/testing.md#independent-expectations The claim base documents disabled=false by default and a boolean-only option. Original indexes 0/1/2 and only index2 disabled are independently expected; string, number, null, object, and array must report the literal boolean path repair.
 *
 * @evidence contracts/testing.md#distinguishing-cases Omitted, explicit false and explicit true contrast string, number, null, object and array input.
 *
 * @evidence contracts/testing.md#execution-ownership TestEvidenceSemanticDisabledClaimsDefaultToEnabledAndRequireABoolean is the selectable unit entry in packages/evidence/native, compiled beside its owning implementation in the shared Go unit process. It invokes decodeGraphConfig and its decoder/assertion helpers in process; its JSON artifact/package names are input strings and trigger no installation, artifact loader, native plugin build, or child process. Its local table variants remain owned by this entry.
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
