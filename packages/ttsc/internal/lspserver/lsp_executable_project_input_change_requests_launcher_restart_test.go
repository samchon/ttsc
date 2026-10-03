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

// TestLSPExecutableProjectInputChangeRequestsLauncherRestart checks the proxy's
// lifecycle frame and restart sentinel for an owned source's reload selection.
//
// The source supplies a URI-equality policy, not actual descriptor evaluation.
// The unit observes the proxy boundary; it does not start a JavaScript launcher,
// compile contributors, forward upstream or assert a physical host restart.
//
//  1. Send a watched change for the source's executable reload URI.
//  2. Assert the proxy announces the expected lifecycle transition, then
//     returns its stable restart sentinel with handled=false.
//  3. Send an unrelated change and assert no error, handled=false and no frame.
//
// @evidence contracts/testing.md#behavioral-verification Actual handleEditorEnvelope for the owned source's reload URI returns handled=false plus ErrLSPPluginSelectionChanged and emits the literal lifecycle method/reason frame. An unrelated URI returns no error, handled=false and no remaining editor bytes. No actual upstream forwarding, native invalidation call or launcher restart is observed.
// @evidence contracts/testing.md#independent-expectations The lifecycle notification and the restart sentinel are literals from the proxy contract.
// @evidence contracts/testing.md#distinguishing-cases The executable reload URI and an unrelated URI take different paths.
// @evidence contracts/testing.md#execution-ownership This Go unit builds an actual Proxy with supported bytes.Buffer/io.Discard streams and an owned optional reload-matcher source embedding NullPluginSource. Actual notification handling and framed output execute, then actual frame/envelope readers decode the result. It creates no directory or sidecar and starts no compiler, process, installed consumer or product host.
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
