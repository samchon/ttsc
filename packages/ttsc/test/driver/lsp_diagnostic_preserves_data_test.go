package driver_test

import (
  "encoding/json"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/internal/lspserver"
)

// TestLSPDiagnosticPreservesData Verifies the proxy carries a diagnostic's data
// through the diagnostic type's decode/re-encode step.
//
// LSP `data` is opaque: the editor stores it on the diagnostic and hands it back
// on a codeAction request whose context includes that diagnostic, so a producer
// can recover what it computed. The proxy decodes each sidecar diagnostic and
// re-encodes it, so a field absent from LSPDiagnostic is silently dropped.
// CodeDescription and tags have corresponding preservation cases. Because
// data is arbitrary JSON, the test also pins that its members survive the
// round trip rather than being dropped (it checks the two members' fragments,
// not byte equality of the whole object).
//
//  1. Decode a diagnostic whose data is an object with two members.
//  2. Assert Data is non-empty and the re-encoded form contains both members.
//
// @evidence contracts/testing.md#behavioral-verification JSON decode and re-encode of LSPDiagnostic retain nonempty Data and both ruleKey and hasQuickFix fragments.
// @evidence contracts/testing.md#independent-expectations Opaque LSP diagnostic data must survive forwarding; literal fixture members establish the expected contents independently of the schema implementation.
// @evidence contracts/testing.md#distinguishing-cases An object with string and boolean members owns the populated data case; absent data is checked by its negative twin, and full object byte equality is not asserted.
// @evidence contracts/testing.md#execution-ownership Go test/driver exercises the lspserver diagnostic wire type directly through encoding/json, without running a proxy or sidecar.
func TestLSPDiagnosticPreservesData(t *testing.T) {
  input := []byte(`{"range":{"start":{"line":0,"character":0},"end":{"line":0,"character":4}},"code":"no-x","message":"m","data":{"ruleKey":"abc","hasQuickFix":true}}`)

  var decoded lspserver.LSPDiagnostic
  if err := json.Unmarshal(input, &decoded); err != nil {
    t.Fatalf("decode: %v", err)
  }
  if len(decoded.Data) == 0 {
    t.Fatal("data was dropped on decode")
  }

  reencoded, err := json.Marshal(decoded)
  if err != nil {
    t.Fatalf("re-encode: %v", err)
  }
  if !strings.Contains(string(reencoded), `"ruleKey":"abc"`) ||
    !strings.Contains(string(reencoded), `"hasQuickFix":true`) {
    t.Fatalf("data did not round-trip intact:\n%s", reencoded)
  }
}

// TestLSPDiagnosticOmitsAbsentData Verifies absent diagnostic data remains absent.
//
// Data must not sprout a null or empty field. Most diagnostics carry no data,
// so a `"data":null` on every one would be noise, and some clients treat a
// present-but-null data differently from an absent one.
//
// 1. Decode the diagnostic fixture without data.
// 2. Re-encode it and require the data key to remain absent.
//
// @evidence contracts/testing.md#behavioral-verification JSON round-trip of a diagnostic without data must not produce a data key.
// @evidence contracts/testing.md#independent-expectations LSP optional data absence must remain absence, rather than a synthesized null or empty value.
// @evidence contracts/testing.md#distinguishing-cases This owns absent data; TestLSPDiagnosticPreservesData owns the populated object case.
// @evidence contracts/testing.md#execution-ownership Go discovers the absence unit beside its populated twin in test/driver and serializes the actual diagnostic type in process.
func TestLSPDiagnosticOmitsAbsentData(t *testing.T) {
  input := []byte(`{"range":{"start":{"line":0,"character":0},"end":{"line":0,"character":4}},"code":"no-x","message":"m"}`)

  var decoded lspserver.LSPDiagnostic
  if err := json.Unmarshal(input, &decoded); err != nil {
    t.Fatalf("decode: %v", err)
  }
  reencoded, err := json.Marshal(decoded)
  if err != nil {
    t.Fatalf("re-encode: %v", err)
  }
  if strings.Contains(string(reencoded), "data") {
    t.Fatalf("absent data must not appear on the wire:\n%s", reencoded)
  }
}
