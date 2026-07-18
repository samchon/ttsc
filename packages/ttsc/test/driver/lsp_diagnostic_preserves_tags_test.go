package driver_test

import (
  "encoding/json"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/internal/lspserver"
)

// TestLSPDiagnosticPreservesTags verifies the proxy carries a diagnostic's tags
// through its decode/re-encode step.
//
// The proxy decodes each sidecar diagnostic into LSPDiagnostic and re-encodes
// it, so a field absent from that struct is silently dropped on the way to the
// editor. Tags are the greying and strike-through an editor renders from
// DiagnosticTag; without this field a plugin marking an unused import
// "unnecessary" would decode to nothing and the fade would never reach the user.
//
//  1. Decode a diagnostic carrying tags [1, 2].
//  2. Assert both survive the round trip in order.
func TestLSPDiagnosticPreservesTags(t *testing.T) {
  input := []byte(`{"range":{"start":{"line":0,"character":0},"end":{"line":0,"character":4}},"code":"no-unused-vars","message":"'x' is never used","tags":[1,2]}`)

  var decoded lspserver.LSPDiagnostic
  if err := json.Unmarshal(input, &decoded); err != nil {
    t.Fatalf("decode: %v", err)
  }
  if len(decoded.Tags) != 2 || decoded.Tags[0] != 1 || decoded.Tags[1] != 2 {
    t.Fatalf("tags = %v, want [1 2]", decoded.Tags)
  }

  reencoded, err := json.Marshal(decoded)
  if err != nil {
    t.Fatalf("re-encode: %v", err)
  }
  if !strings.Contains(string(reencoded), `"tags":[1,2]`) {
    t.Fatalf("tags dropped on re-encode:\n%s", reencoded)
  }
}

// TestLSPDiagnosticOmitsAbsentTags is the negative twin: a diagnostic with no
// tags must not sprout an empty array. Most findings are neither unnecessary nor
// deprecated, so the common case is no tags at all, and `"tags":[]` on every one
// would be noise the editor has to interpret.
//
//  1. Decode a diagnostic with no tags field.
//  2. Assert the re-encoded form has no tags key.
func TestLSPDiagnosticOmitsAbsentTags(t *testing.T) {
  input := []byte(`{"range":{"start":{"line":0,"character":0},"end":{"line":0,"character":4}},"code":"no-var","message":"unexpected var"}`)

  var decoded lspserver.LSPDiagnostic
  if err := json.Unmarshal(input, &decoded); err != nil {
    t.Fatalf("decode: %v", err)
  }
  if decoded.Tags != nil {
    t.Fatalf("tags = %v, want nil", decoded.Tags)
  }

  reencoded, err := json.Marshal(decoded)
  if err != nil {
    t.Fatalf("re-encode: %v", err)
  }
  if strings.Contains(string(reencoded), "tags") {
    t.Fatalf("absent tags must not appear on the wire:\n%s", reencoded)
  }
}
