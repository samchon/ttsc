package lspserver

import (
  "encoding/json"
  "io"
  "testing"
)

// incrementalSaveSource records how a save and a dirty edit reach the daemon.
type incrementalSaveSource struct {
  NullPluginSource
  calls [][]string
}

func (s *incrementalSaveSource) InvalidateResidentPrograms(uris ...string) {
  s.calls = append(s.calls, append([]string(nil), uris...))
}

// TestLSPDidSaveKeepsTheIncrementalChangedURIPath checks recorded invalidation
// dispatch for a supplied save URI followed by a ranged change notification.
//
// The owned recorder implements the supported resident invalidation capability;
// it does not create a daemon or compiler Program. No initial document text is
// cached, so this unit does not establish successful ranged text splicing,
// incremental compiler reuse or avoided parse/bind/checker work.
//
//  1. Supply a save notification and assert the recorder receives one URI.
//  2. Send a ranged didChange for the same document.
//  3. Assert no further resident invalidation was recorded.
//
// @evidence contracts/testing.md#behavioral-verification Actual handleEditorEnvelope dispatches exactly one supplied URI to the owned InvalidateResidentPrograms recorder for didSave. A subsequent ranged didChange returns without another recorded invalidation. No actual daemon update or cached-text splice result is asserted.
// @evidence contracts/testing.md#independent-expectations The expected single URI and zero further invalidations are literal.
// @evidence contracts/testing.md#distinguishing-cases Save and keystroke edits are the two signals; widening other signals must not change either.
// @evidence contracts/testing.md#execution-ownership This Go unit constructs the actual Proxy with supported discard streams and an owned optional-capability recorder embedding NullPluginSource, then invokes its notification handler on authored JSON. It creates no directory or sidecar and starts no compiler, process or product host. Save schedules NullPluginSource diagnostics asynchronously without joining or asserting that result; the observed recorder calls are synchronous dispatch.
func TestLSPDidSaveKeepsTheIncrementalChangedURIPath(t *testing.T) {
  const uri = "file:///project/src/main.ts"
  plugins := &incrementalSaveSource{}
  proxy := NewProxy(ProxyOptions{
    EditorOut:  io.Discard,
    UpstreamIn: io.Discard,
    Source:     plugins,
  })

  saveParams, _ := json.Marshal(map[string]any{
    "textDocument": map[string]any{"uri": uri},
  })
  if _, err := proxy.handleEditorEnvelope(Envelope{
    JSONRPC: "2.0",
    Method:  methodDidSave,
    Params:  saveParams,
  }, nil); err != nil {
    t.Fatalf("didSave: %v", err)
  }
  if len(plugins.calls) != 1 {
    t.Fatalf("didSave resident invalidations = %v, want exactly one", plugins.calls)
  }
  if len(plugins.calls[0]) != 1 || plugins.calls[0][0] != uri {
    t.Errorf("didSave resident invalidation = %v, want the incremental changed uri %q", plugins.calls[0], uri)
  }

  changeParams, _ := json.Marshal(map[string]any{
    "textDocument": map[string]any{"uri": uri, "version": 2},
    "contentChanges": []any{map[string]any{
      "range": map[string]any{
        "start": map[string]any{"line": 0, "character": 0},
        "end":   map[string]any{"line": 0, "character": 0},
      },
      "text": "x",
    }},
  })
  if _, err := proxy.handleEditorEnvelope(Envelope{
    JSONRPC: "2.0",
    Method:  methodDidChange,
    Params:  changeParams,
  }, nil); err != nil {
    t.Fatalf("didChange: %v", err)
  }
  if len(plugins.calls) != 1 {
    t.Errorf("didChange on a dirty buffer reached the resident daemon: calls = %v", plugins.calls)
  }
}
