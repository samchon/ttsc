package driver_test

import (
  "encoding/json"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/internal/lspserver"
)

// TestLSPDiagnosticPreservesCodeDescription Verifies the proxy's diagnostic wire
// type carries a codeDescription instead of dropping it.
//
// The proxy decodes each sidecar diagnostic into LSPDiagnostic and re-encodes
// it, so any LSP Diagnostic field the struct omits is silently truncated before
// the editor sees it. codeDescription was one such field: a producer could set
// it and the editor would never receive the docs link. This asserts a round
// trip through the exported struct preserves href.
//
// 1. Decode a diagnostic with an authored codeDescription href.
// 2. Check the decoded href and re-encode the diagnostic.
// 3. Assert the JSON retains that codeDescription href.
//
// @evidence contracts/testing.md#behavioral-verification LSPDiagnostic JSON decoding and encoding retain codeDescription.href.
// @evidence contracts/testing.md#independent-expectations The authored URL and optional LSP diagnostic field establish the expected value.
// @evidence contracts/testing.md#distinguishing-cases Present href contrasts with the separate omitted-field case.
// @evidence contracts/testing.md#execution-ownership Go unit TestLSPDiagnosticPreservesCodeDescription is discovered by go test in test/driver and invokes source/shim operations directly. Temporary filesystem inputs do not install a consumer or build a host artifact.
func TestLSPDiagnosticPreservesCodeDescription(t *testing.T) {
  const href = "https://ttsc.dev/docs/lint/rules/core"
  input := []byte(`{
    "range": {"start": {"line": 0, "character": 0}, "end": {"line": 0, "character": 3}},
    "code": "no-var",
    "codeDescription": {"href": "` + href + `"},
    "source": "@ttsc/lint",
    "message": "Unexpected var."
  }`)

  var decoded lspserver.LSPDiagnostic
  if err := json.Unmarshal(input, &decoded); err != nil {
    t.Fatalf("decode: %v", err)
  }
  if decoded.CodeDescription == nil {
    t.Fatal("codeDescription was dropped on decode; the proxy would truncate it")
  }
  if decoded.CodeDescription.Href != href {
    t.Fatalf("href = %q, want %q", decoded.CodeDescription.Href, href)
  }

  reencoded, err := json.Marshal(decoded)
  if err != nil {
    t.Fatalf("encode: %v", err)
  }
  if !strings.Contains(string(reencoded), `"codeDescription":{"href":"`+href+`"}`) {
    t.Fatalf("codeDescription not preserved on re-encode:\n%s", reencoded)
  }
}

// TestLSPDiagnosticOmitsAbsentCodeDescription Verifies a diagnostic
// with no codeDescription must not emit the key, so ordinary diagnostics omit this
// optional field and editors are not handed an empty object.
//
// An optional unset LSP field must not become an empty object.
//
// 1. Construct a diagnostic without CodeDescription.
// 2. Marshal it and assert the optional key is absent.
//
// @evidence contracts/testing.md#behavioral-verification Marshalling an unset CodeDescription omits its key.
// @evidence contracts/testing.md#independent-expectations An optional unset LSP field must not become an empty object.
// @evidence contracts/testing.md#distinguishing-cases Absent field contrasts with the href round trip; other fields are not byte-compared.
// @evidence contracts/testing.md#execution-ownership Go unit TestLSPDiagnosticOmitsAbsentCodeDescription is discovered by go test in test/driver and invokes source/shim operations directly. Temporary filesystem inputs do not install a consumer or build a host artifact.
func TestLSPDiagnosticOmitsAbsentCodeDescription(t *testing.T) {
  diagnostic := lspserver.LSPDiagnostic{
    Code:    "no-var",
    Source:  "@ttsc/lint",
    Message: "Unexpected var.",
  }
  encoded, err := json.Marshal(diagnostic)
  if err != nil {
    t.Fatalf("encode: %v", err)
  }
  if strings.Contains(string(encoded), "codeDescription") {
    t.Fatalf("absent codeDescription leaked into JSON:\n%s", encoded)
  }
}
