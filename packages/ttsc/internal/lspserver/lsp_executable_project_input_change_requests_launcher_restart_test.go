package lspserver

import (
  "bytes"
  "encoding/json"
  "errors"
  "io"
  "testing"
)

type executableProjectInputSource struct {
  NullPluginSource
  reloadURI string
}

func (s executableProjectInputSource) ProjectInputReloadMatchesChange(
  uri string,
  _ *int,
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
//  2. Assert the proxy announces the expected lifecycle transition, then
//     returns its stable restart sentinel before forwarding.
//  3. Send an unrelated change and assert it follows the ordinary forwarded
//     invalidation path without another lifecycle notification.
func TestLSPExecutableProjectInputChangeRequestsLauncherRestart(t *testing.T) {
  reloadURI := "file:///project/lint.config.ts"
  var editor bytes.Buffer
  proxy := NewProxy(ProxyOptions{
    EditorOut:  &editor,
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
  _, body, err := NewFrameReader(&editor).Read()
  if err != nil {
    t.Fatalf("read plugin-selection notification: %v", err)
  }
  notification, err := ParseEnvelope(body)
  if err != nil {
    t.Fatalf("parse plugin-selection notification: %v", err)
  }
  if notification.Method != methodPluginSelectionChanged {
    t.Fatalf(
      "notification method = %q, want %q",
      notification.Method,
      methodPluginSelectionChanged,
    )
  }
  var params map[string]string
  if err := json.Unmarshal(notification.Params, &params); err != nil {
    t.Fatalf("parse plugin-selection notification params: %v", err)
  }
  if params["reason"] != "projectInputChanged" {
    t.Fatalf("notification params = %#v", params)
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
  if editor.Len() != 0 {
    t.Fatalf("ordinary change wrote an unexpected editor frame: %q", editor.String())
  }
}
