package lspserver

import (
  "errors"
  "io"
  "testing"
)

type executableProjectInputSource struct {
  NullPluginSource
  reloadURI string
}

func (s executableProjectInputSource) ProjectInputReloadMatchesURI(
  uri string,
) bool {
  return uri == s.reloadURI
}

// TestLSPExecutableProjectInputChangeRequestsLauncherRestart verifies an input
// that can alter the descriptor's contributor set cannot be handled as an
// ordinary native resident-program refresh.
//
// The JavaScript launcher owns descriptor evaluation and native contributor
// compilation, so the already-running Go process cannot safely mutate this
// selection in place.
//
//  1. Send a watched change for the source's executable reload URI.
//  2. Assert the proxy returns its stable restart sentinel before forwarding.
//  3. Send an unrelated change and assert it follows the ordinary forwarded
//     invalidation path.
func TestLSPExecutableProjectInputChangeRequestsLauncherRestart(t *testing.T) {
  reloadURI := "file:///project/lint.config.ts"
  proxy := NewProxy(ProxyOptions{
    EditorOut:  io.Discard,
    UpstreamIn: io.Discard,
    Source: executableProjectInputSource{
      reloadURI: reloadURI,
    },
  })
  handled, err := proxy.handleEditorEnvelope(
    watchedFilesEnvelope(
      t,
      `{"changes":[{"uri":"`+reloadURI+`","type":2}]}`,
    ),
    nil,
  )
  if handled {
    t.Fatal("executable reload notification was marked locally handled")
  }
  if !errors.Is(err, ErrLSPPluginSelectionChanged) {
    t.Fatalf("reload error = %v, want %v", err, ErrLSPPluginSelectionChanged)
  }

  handled, err = proxy.handleEditorEnvelope(
    watchedFilesEnvelope(
      t,
      `{"changes":[{"uri":"file:///project/src/main.ts","type":2}]}`,
    ),
    nil,
  )
  if err != nil {
    t.Fatalf("ordinary watched change: %v", err)
  }
  if handled {
    t.Fatal("ordinary watched change was swallowed instead of forwarded")
  }
}
