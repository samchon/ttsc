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

// TestProjectInputRegistrationRechecksSelectionBaseline verifies the client
// registration response closes the last unobserved startup interval.
//
// Constructor validation happens before initialize and dynamic registration.
// A reload input can change in that interval without producing a replayable
// event. Once the client confirms registration, a second baseline check must
// either cover the earlier change or hand all later changes to the watcher.
//
//  1. Publish one exact reload-file watcher with a current baseline.
//  2. Leave the client registration request pending.
//  3. Mark the selection baseline stale before accepting registration.
//  4. Prove the proxy notifies the client and requests an expected restart.
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
