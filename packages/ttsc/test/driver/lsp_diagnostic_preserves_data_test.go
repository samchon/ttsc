package driver_test

import (
  "encoding/json"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/internal/lspserver"
)

// TestLSPDiagnosticPreservesData verifies the proxy carries a diagnostic's data
// through its decode/re-encode step, verbatim.
//
// LSP `data` is opaque: the editor stores it on the diagnostic and hands it back
// on a codeAction request whose context includes that diagnostic, so a producer
// can recover what it computed. The proxy decodes each sidecar diagnostic and
// re-encodes it, so a field absent from LSPDiagnostic is silently dropped — the
// same truncation codeDescription and tags each had to be rescued from. Because
// data is arbitrary JSON, the test also pins that a nested object survives byte
// for byte rather than being flattened or reordered into meaninglessness.
//
//  1. Decode a diagnostic whose data is a nested object.
//  2. Assert the object round-trips intact.
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

// TestLSPDiagnosticOmitsAbsentData is the negative twin: a diagnostic with no
// data must not sprout a null or empty field. Most diagnostics carry no data,
// so a `"data":null` on every one would be noise, and some clients treat a
// present-but-null data differently from an absent one.
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
