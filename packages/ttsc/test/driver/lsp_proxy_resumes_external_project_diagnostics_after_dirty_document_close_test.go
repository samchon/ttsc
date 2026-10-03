package driver_test

import (
  "testing"
  "time"
)

// TestLSPProxyResumesExternalProjectDiagnosticsAfterDirtyDocumentClose Verifies
// an external refresh deferred for unsaved text is not lost when that buffer is
// closed without a save.
//
// Project rules read the on-disk Program, so publishing while any buffer is
// dirty could combine incompatible generations. Closing the final dirty buffer
// must resume the pending refresh even though no didSave notification arrives.
//
//  1. Open one dirty TypeScript buffer and report an external input change.
//  2. Assert no project contributor runs while the buffer is dirty.
//  3. Close the buffer and observe the pending config-URI publication.
//
// @evidence contracts/testing.md#behavioral-verification Proxy.Run performs no project diagnostic callback while dirty and later publishes one config-URI finding after didClose.
// @evidence contracts/testing.md#independent-expectations Disk-backed project work cannot describe unsaved text, but closing the last dirty buffer must allow the pending external refresh to run.
// @evidence contracts/testing.md#distinguishing-cases An external event during a dirty open is deferred, then close without save resumes it; zero calls is observed after a 150ms wait.
// @evidence contracts/testing.md#execution-ownership The Go test/driver pipe proxy uses the external-project stub and authored notifications, not an actual sidecar or watcher.
func TestLSPProxyResumesExternalProjectDiagnosticsAfterDirtyDocumentClose(t *testing.T) {
  const externalURI = "file:///project/docs/spec.md"
  const dirtyURI = "file:///project/src/dirty.ts"
  source := &externalProjectDiagnosticsSource{externalURI: externalURI}
  h := newProxyHarness(t, source)

  didOpen := []byte(`{"jsonrpc":"2.0","method":"textDocument/didOpen","params":{"textDocument":{"uri":"file:///project/src/dirty.ts","version":1,"languageId":"typescript","text":"unsaved"}}}`)
  h.sendEditor(didOpen)
  _ = h.recvUpstream()

  sendWatchedFileChange(t, h, externalURI)
  time.Sleep(150 * time.Millisecond)
  source.mu.Lock()
  callsWhileDirty := source.diagnosticsCalls
  source.mu.Unlock()
  if callsWhileDirty != 0 {
    t.Fatalf("project diagnostics ran while dirty: %d", callsWhileDirty)
  }

  didClose := []byte(`{"jsonrpc":"2.0","method":"textDocument/didClose","params":{"textDocument":{"uri":"` + dirtyURI + `"}}}`)
  h.sendEditor(didClose)
  _ = h.recvUpstream()
  publication := decodeProjectPublication(t, h.recvEditor())
  if publication.URI != "file:///project/tsconfig.json" ||
    len(publication.Diagnostics) != 1 {
    t.Fatalf("resumed project publication = %#v", publication)
  }
}
