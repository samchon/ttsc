package lspserver

import (
  "bytes"
  "errors"
  "path/filepath"
  "testing"
)

type driftingProjectInputRegistrationSource struct {
  NullPluginSource
  current  bool
  snapshot LSPProjectInputSnapshot
}

func (s *driftingProjectInputRegistrationSource) ProjectInputs() LSPProjectInputSnapshot {
  return copyProjectInputSnapshot(s.snapshot)
}

func (s *driftingProjectInputRegistrationSource) ProjectInputReloadFingerprintsAreCurrent() bool {
  return s.current
}

// TestProjectInputRegistrationRechecksSelectionBaseline verifies accepting a
// pending client registration rechecks supplied selection currentness.
//
// Constructor validation happens before initialize and dynamic registration.
// A reload input can change in that interval without producing a replayable
// event. Here an owned source reports stale currentness immediately before the
// pending response is delivered; actual filesystem drift and later watcher
// delivery are not exercised.
//
//  1. Publish one exact reload-file watcher with a current baseline.
//  2. Leave the client registration request pending.
//  3. Mark the selection baseline stale before accepting registration.
//  4. Prove the proxy notifies the client and requests an expected restart.
//
// @evidence contracts/testing.md#behavioral-verification The actual pending-request callback sees the supplied currentness change and emits selection-change method text plus ErrLSPPluginSelectionChanged to the async error channel. No launcher restart or actual filesystem change is observed.
// @evidence contracts/testing.md#independent-expectations Authored current=true then false controls the source; method text presence uses the maintained method constant and errors.Is uses the declared restart sentinel. These assertions do not independently decode the complete notification payload.
// @evidence contracts/testing.md#distinguishing-cases One registration remains pending while currentness is changed to false, then an accepted response reaches the recheck. This unit does not cover a current baseline, a rejected response or actual concurrent watch delivery.
// @evidence contracts/testing.md#execution-ownership The discoverable Go unit executes actual Proxy registration/response operations using an owned interface implementation, bytes buffer and temporary root used as path data. No sidecar, installed consumer, native child, product host or real editor runs; no foreign method is replaced.
func TestProjectInputRegistrationRechecksSelectionBaseline(t *testing.T) {
  root := t.TempDir()
  source := &driftingProjectInputRegistrationSource{
    current: true,
    snapshot: LSPProjectInputSnapshot{
      Root: filepath.ToSlash(root),
      ReloadFiles: []string{
        filepath.ToSlash(filepath.Join(root, "lint.config.cjs")),
      },
    },
  }
  editorOut := &bytes.Buffer{}
  proxy := NewProxy(ProxyOptions{
    EditorOut: editorOut,
    Source:    source,
  })
  proxy.projectInputWatchReady = true
  proxy.projectInputWatchDynamic = true
  proxy.projectInputWatchRelative = true

  proxy.projectInputsRefreshed()
  source.current = false
  respondToPendingProjectInputWatchRequest(t, proxy, false, "")

  if !bytes.Contains(editorOut.Bytes(), []byte(methodPluginSelectionChanged)) {
    t.Fatalf("selection-change notification missing from %q", editorOut.String())
  }
  select {
  case err := <-proxy.asyncErrCh:
    if !errors.Is(err, ErrLSPPluginSelectionChanged) {
      t.Fatalf("registration drift error = %v", err)
    }
  default:
    t.Fatal("registration drift did not request a launcher restart")
  }
}
