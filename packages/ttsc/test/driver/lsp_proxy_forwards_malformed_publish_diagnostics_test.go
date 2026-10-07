package driver_test

import (
  "bytes"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPProxyForwardsMalformedPublishDiagnostics Verifies that malformed publishDiagnostics params reach the editor byte for byte.
//
// Non-object params contrast with augmentable diagnostics in separate entries.
//
// 1. Configure a source that would contribute a diagnostic.
// 2. Send upstream a publishDiagnostics with non-object params.
// 3. Assert the editor sees the same bytes.
//
// @evidence contracts/testing.md#behavioral-verification Malformed publishDiagnostics params reach the editor byte for byte.
// @evidence contracts/testing.md#independent-expectations The authored payload defines safe forwarding when params cannot be interpreted.
// @evidence contracts/testing.md#distinguishing-cases Non-object params contrast with augmentable diagnostics in separate entries.
// @evidence contracts/testing.md#execution-ownership A stub source and Go proxy pipes exercise the malformed notification path. Go discovers TestLSPProxyForwardsMalformedPublishDiagnostics under ./test/driver.
func TestLSPProxyForwardsMalformedPublishDiagnostics(t *testing.T) {
  source := &stubSource{
    diagnostics: map[string][]driver.LSPDiagnostic{
      "file:///a.ts": {{Message: "x"}},
    },
  }
  h := newProxyHarness(t, source)

  payload := []byte(`{"jsonrpc":"2.0","method":"textDocument/publishDiagnostics","params":"oops"}`)
  h.sendUpstream(payload)
  body := h.recvEditor()
  if !bytes.Equal(body, payload) {
    t.Fatalf("malformed publishDiagnostics was rewritten:\n%s", body)
  }
}
