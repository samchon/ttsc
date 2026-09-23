package driver_test

import (
  "encoding/json"
  "io"
  "testing"
  "time"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPProxyForwardsDidSaveWhileAPublicationWriteIsHeld verifies the editor
// pump forwards a document notification upstream while a diagnostics
// publication is still writing to the editor (samchon/ttsc#1441).
//
// A publication decided its frame under the diagnostics state lock and kept
// that lock through the write, and the pump takes the lock for every document
// notification before forwarding it. An editor that had not read the
// publication yet therefore held the next notification back from tsgo, which
// is how TestLSPProxyDidSavePublishesVersionlessPluginDiagnostics failed on CI
// whenever the publication goroutine reached the lock before the pump did.
//
//  1. Arm the editor output so its next write holds, save a document, and wait
//     until the save's plugin publication is inside that write.
//  2. Assert the save reaches upstream, and a second save after it too, while
//     the publication is still held.
//  3. Release the write and assert the editor receives both publications.
func TestLSPProxyForwardsDidSaveWhileAPublicationWriteIsHeld(t *testing.T) {
  source := &stubSource{
    diagnosticsFor: func(driver.LSPDocumentVersion) []driver.LSPDiagnostic {
      return []driver.LSPDiagnostic{{Source: "ttsc/lint", Message: "saved"}}
    },
  }
  var gate *editorGate
  h := newProxyHarnessWithEditorOut(t, source, driver.ProxyOptions{}, func(w io.Writer) io.Writer {
    gate = newEditorGate(w)
    return gate
  })
  t.Cleanup(gate.open)
  save := []byte(`{"jsonrpc":"2.0","method":"textDocument/didSave","params":{"textDocument":{"uri":"file:///a.ts"}}}`)
  forwarded := func(label string) {
    t.Helper()
    body := h.recvUpstream()
    var decoded struct {
      Method string `json:"method"`
    }
    if err := json.Unmarshal(body, &decoded); err != nil || decoded.Method != "textDocument/didSave" {
      t.Fatalf("the %s save was not what reached upstream: %s", label, body)
    }
  }

  gate.arm()
  h.sendEditor(save)
  select {
  case <-gate.entered:
  case <-time.After(proxyHarnessFrameTimeout):
    t.Fatalf("the save's publication did not write to the editor in %s", proxyHarnessFrameTimeout)
  }
  forwarded("first")
  h.sendEditor(save)
  forwarded("second")

  gate.open()
  for index := 0; index < 2; index++ {
    body := h.recvEditor()
    var decoded struct {
      Method string `json:"method"`
      Params struct {
        Diagnostics []struct {
          Message string `json:"message"`
        } `json:"diagnostics"`
      } `json:"params"`
    }
    if err := json.Unmarshal(body, &decoded); err != nil {
      t.Fatalf("editor frame %d was not JSON: %v\n%s", index, err, body)
    }
    if decoded.Method != "textDocument/publishDiagnostics" ||
      len(decoded.Params.Diagnostics) != 1 ||
      decoded.Params.Diagnostics[0].Message != "saved" {
      t.Fatalf("editor frame %d is not the save's publication: %s", index, body)
    }
  }
}
