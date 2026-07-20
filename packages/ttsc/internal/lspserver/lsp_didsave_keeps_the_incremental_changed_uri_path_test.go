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

// TestLSPDidSaveKeepsTheIncrementalChangedURIPath verifies the two boundaries the
// new open and watched-file invalidations must not erode: a save of a known
// source still travels as one changed URI, and a didChange on a dirty buffer
// still sends the resident daemon nothing at all.
//
// The resident daemon exists to avoid a cold parse+bind+checker per verb. A save
// that degraded into a full reload, or an invalidation per keystroke, would trade
// exactly that away — so widening the set of signals that reach the daemon has to
// leave these two untouched.
//
//  1. Save a document and assert the daemon is told that one URI changed.
//  2. Send a ranged didChange for the same document.
//  3. Assert no further resident invalidation was recorded.
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
