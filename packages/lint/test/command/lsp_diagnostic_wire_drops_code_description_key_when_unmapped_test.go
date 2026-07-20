package linthost

import (
  "encoding/json"
  "strings"
  "testing"
)

// TestLSPDiagnosticWireDropsCodeDescriptionKeyWhenUnmapped verifies an
// unmapped rule marshals to the exact bytes it produced before this field
// existed.
//
// `codeDescription` is a pointer behind `omitempty`, and the failure mode is
// subtle: a non-nil pointer to a zero struct still marshals as
// `"codeDescription":{"href":""}`, which editors render as a link to nowhere.
// The boundary contract is that an unmapped rule emits no key at all, so its
// diagnostic stays byte-identical to today's.
//
//  1. Marshal a diagnostic for a format rule, the one built-in family with no
//     per-rule documentation page.
//  2. Assert the JSON carries no codeDescription key and round-trips to nil.
//  3. Assert the same shape for a mapped rule does carry the key, so the
//     absence above is the mapping decision and not a marshalling accident.
func TestLSPDiagnosticWireDropsCodeDescriptionKeyWhenUnmapped(t *testing.T) {
  unmapped := lspDiagnostic{
    Code:            "format/quotes",
    CodeDescription: lspCodeDescriptionForRule("format/quotes"),
    Source:          "@ttsc/lint",
    Message:         "Strings must use doublequote.",
  }
  encoded, err := json.Marshal(unmapped)
  if err != nil {
    t.Fatalf("marshal unmapped diagnostic: %v", err)
  }
  if strings.Contains(string(encoded), "codeDescription") {
    t.Fatalf("unmapped rule emitted a codeDescription key: %s", encoded)
  }

  var decoded lspDiagnostic
  if err := json.Unmarshal(encoded, &decoded); err != nil {
    t.Fatalf("unmarshal unmapped diagnostic: %v", err)
  }
  if decoded.CodeDescription != nil {
    t.Fatalf("unmapped rule round-tripped a codeDescription: %#v", decoded.CodeDescription)
  }

  mapped := lspDiagnostic{
    Code:            "no-alert",
    CodeDescription: lspCodeDescriptionForRule("no-alert"),
    Source:          "@ttsc/lint",
    Message:         "Unexpected alert.",
  }
  encodedMapped, err := json.Marshal(mapped)
  if err != nil {
    t.Fatalf("marshal mapped diagnostic: %v", err)
  }
  wantHref := `"codeDescription":{"href":"https://eslint.org/docs/latest/rules/no-alert"}`
  if !strings.Contains(string(encodedMapped), wantHref) {
    t.Fatalf("mapped rule wire shape = %s, want it to contain %s", encodedMapped, wantHref)
  }
}
