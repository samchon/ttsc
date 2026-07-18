package driver_test

import (
  "encoding/json"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/internal/lspserver"
)

// TestLSPDiagnosticPreservesRelatedInformation verifies the proxy carries a
// diagnostic's relatedInformation through its decode/re-encode step.
//
// relatedInformation is how a diagnostic points at a second location — "first
// defined here", "conflicting declaration". The proxy decodes each sidecar
// diagnostic and re-encodes it, so a field absent from LSPDiagnostic is silently
// dropped on the way to the editor — the same truncation codeDescription, tags,
// and data each had to be rescued from. This pins that the nested location's
// uri, range, and message all survive.
func TestLSPDiagnosticPreservesRelatedInformation(t *testing.T) {
  input := []byte(`{"range":{"start":{"line":1,"character":0},"end":{"line":1,"character":10}},"code":"no-redeclare","message":"'x' is already defined.","relatedInformation":[{"location":{"uri":"file:///a.ts","range":{"start":{"line":0,"character":4},"end":{"line":0,"character":5}}},"message":"'x' was first defined here."}]}`)

  var decoded lspserver.LSPDiagnostic
  if err := json.Unmarshal(input, &decoded); err != nil {
    t.Fatalf("decode: %v", err)
  }
  if len(decoded.RelatedInformation) != 1 {
    t.Fatalf("relatedInformation was dropped on decode: %+v", decoded.RelatedInformation)
  }
  if decoded.RelatedInformation[0].Location.URI != "file:///a.ts" {
    t.Fatalf("related location uri lost on decode: %q", decoded.RelatedInformation[0].Location.URI)
  }

  reencoded, err := json.Marshal(decoded)
  if err != nil {
    t.Fatalf("re-encode: %v", err)
  }
  for _, want := range []string{
    `"relatedInformation":[`,
    `"uri":"file:///a.ts"`,
    `"'x' was first defined here."`,
    `"character":4`,
  } {
    if !strings.Contains(string(reencoded), want) {
      t.Fatalf("relatedInformation did not round-trip intact (missing %s):\n%s", want, reencoded)
    }
  }
}

// TestLSPDiagnosticOmitsAbsentRelatedInformation is the negative twin: a
// diagnostic with no relatedInformation must not sprout a null or empty field,
// or every plain diagnostic would carry the noise.
func TestLSPDiagnosticOmitsAbsentRelatedInformation(t *testing.T) {
  input := []byte(`{"range":{"start":{"line":0,"character":0},"end":{"line":0,"character":4}},"code":"no-x","message":"m"}`)

  var decoded lspserver.LSPDiagnostic
  if err := json.Unmarshal(input, &decoded); err != nil {
    t.Fatalf("decode: %v", err)
  }
  reencoded, err := json.Marshal(decoded)
  if err != nil {
    t.Fatalf("re-encode: %v", err)
  }
  if strings.Contains(string(reencoded), "relatedInformation") {
    t.Fatalf("absent relatedInformation must not appear on the wire:\n%s", reencoded)
  }
}
