package driver_test

import (
  "encoding/json"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/internal/lspserver"
)

// TestLSPDiagnosticPreservesRelatedInformation Verifies that LSPDiagnostic JSON decoding and encoding preserve one related URI, start character, and message.
//
// The populated array is checked, but the full range and every unrelated field are not compared.
//
// 1. Decode a diagnostic containing one related location and message.
// 2. Encode the DTO again and assert the related URI, message, and start character remain.
//
// @evidence contracts/testing.md#behavioral-verification LSPDiagnostic JSON decoding and encoding preserve one related URI, start character, and message.
// @evidence contracts/testing.md#independent-expectations Literal input JSON defines the related-information values independently of the encoder.
// @evidence contracts/testing.md#distinguishing-cases The populated array is checked, but the full range and every unrelated field are not compared.
// @evidence contracts/testing.md#execution-ownership encoding/json operates directly on the owning lspserver DTO in this Go entry. Go discovers TestLSPDiagnosticPreservesRelatedInformation under ./test/driver.
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
  var roundTripped lspserver.LSPDiagnostic
  if err := json.Unmarshal(reencoded, &roundTripped); err != nil {
    t.Fatalf("decode result: %v", err)
  }
  if len(roundTripped.RelatedInformation) != 1 {
    t.Fatalf("encoded related-information membership was lost: %+v", roundTripped.RelatedInformation)
  }
  related := roundTripped.RelatedInformation[0]
  if related.Location.URI != "file:///a.ts" || related.Location.Range.Start.Character != 4 || related.Message != "'x' was first defined here." {
    t.Fatalf("authored values were not preserved inside the related-information entry: %+v", related)
  }
}

// TestLSPDiagnosticOmitsAbsentRelatedInformation Verifies that LSPDiagnostic encoding omits relatedInformation when input lacks it.
//
// The absent-field negative complements populated information in its sibling.
//
// 1. Decode a diagnostic without relatedInformation.
// 2. Encode it and assert the optional field is absent.
//
// @evidence contracts/testing.md#behavioral-verification LSPDiagnostic encoding omits relatedInformation when input lacks it while retaining the literal code, message and end character.
// @evidence contracts/testing.md#independent-expectations The authored input omits the optional field, independently specifying absence.
// @evidence contracts/testing.md#distinguishing-cases The absent-field negative complements populated information in its sibling.
// @evidence contracts/testing.md#execution-ownership encoding/json operates directly on the owning lspserver DTO in Go. Go discovers TestLSPDiagnosticOmitsAbsentRelatedInformation under ./test/driver.
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
  var roundTripped lspserver.LSPDiagnostic
  if err := json.Unmarshal(reencoded, &roundTripped); err != nil {
    t.Fatalf("decode result: %v", err)
  }
  if roundTripped.Code != "no-x" || roundTripped.Message != "m" || roundTripped.Range.End.Character != 4 {
    t.Fatalf("ordinary diagnostic fields were lost while omitting relatedInformation: %+v", roundTripped)
  }
}
