package lspserver

import (
  "bytes"
  "encoding/json"
  "io"
  "testing"
)

// TestLSPDeletedWatchedFileWithdrawsPluginDiagnostics verifies that deleting a
// file on disk removes the findings ttsc last published for it, while leaving
// the compiler's own diagnostics for the same document alone.
//
// Dropping the warm Program is not enough on its own. An open document's content
// belongs to the client rather than to disk, so the compiler has no reason to
// republish for a URI whose file was deleted underneath it, and without that
// republish nothing triggers the merge that would replace ttsc's cached set. The
// user would keep looking at lint findings for a file that no longer exists.
//
//  1. Seed one upstream and one plugin diagnostic for a document.
//  2. Send a watched-file deletion for that document.
//  3. Assert the republished set keeps the upstream diagnostic and drops the
//     plugin one, and that a plain change publishes nothing by itself.
func TestLSPDeletedWatchedFileWithdrawsPluginDiagnostics(t *testing.T) {
  const uri = "file:///project/src/gone.ts"
  var editor bytes.Buffer
  proxy := NewProxy(ProxyOptions{
    EditorOut:  &editor,
    UpstreamIn: io.Discard,
    Source:     NullPluginSource{},
  })
  proxy.rememberUpstreamDiagnostics(uri, nil, []json.RawMessage{
    json.RawMessage(`{"message":"from the compiler"}`),
  })
  proxy.rememberPluginDiagnostics(uri, nil, []LSPDiagnostic{{Message: "from the rule"}})

  deletion, _ := json.Marshal(map[string]any{
    "changes": []any{map[string]any{"uri": uri, "type": fileChangeTypeDeleted}},
  })
  handled, err := proxy.handleEditorEnvelope(Envelope{
    JSONRPC: "2.0",
    Method:  methodDidChangeWatchedFiles,
    Params:  deletion,
  }, nil)
  if err != nil {
    t.Fatalf("watched-file deletion: %v", err)
  }
  if handled {
    t.Fatal("watched-file deletion was swallowed instead of forwarded to tsgo")
  }

  _, body, err := NewFrameReader(bytes.NewReader(editor.Bytes())).Read()
  if err != nil {
    t.Fatalf("read republished diagnostics: %v", err)
  }
  published := decodePublishedDiagnostics(t, body)
  if published.URI != uri {
    t.Fatalf("republished uri = %q, want %q", published.URI, uri)
  }
  if len(published.Diagnostics) != 1 {
    t.Fatalf("republished %d diagnostics, want only the compiler's: %s", len(published.Diagnostics), body)
  }
  if published.Diagnostics[0].Message != "from the compiler" {
    t.Errorf("republished diagnostic = %q, want the compiler's", published.Diagnostics[0].Message)
  }

  // Negative twin: an ordinary edit withdraws nothing. Its findings are still
  // valid until the sidecar recomputes them, and the ordinary republish path
  // owns that replacement.
  editor.Reset()
  proxy.rememberPluginDiagnostics(uri, nil, []LSPDiagnostic{{Message: "from the rule"}})
  change, _ := json.Marshal(map[string]any{
    "changes": []any{map[string]any{"uri": uri, "type": fileChangeTypeChanged}},
  })
  if _, err := proxy.handleEditorEnvelope(Envelope{
    JSONRPC: "2.0",
    Method:  methodDidChangeWatchedFiles,
    Params:  change,
  }, nil); err != nil {
    t.Fatalf("watched-file change: %v", err)
  }
  if editor.Len() != 0 {
    t.Errorf("a plain watched-file change republished diagnostics: %s", editor.Bytes())
  }
}

// publishedDiagnostics is the slice of a publishDiagnostics notification this
// test asserts on: which document it targets and the message of each entry.
type publishedDiagnostics struct {
  URI         string `json:"uri"`
  Diagnostics []struct {
    Message string `json:"message"`
  } `json:"diagnostics"`
}

func decodePublishedDiagnostics(t *testing.T, body []byte) publishedDiagnostics {
  t.Helper()
  env, err := ParseEnvelope(body)
  if err != nil {
    t.Fatalf("parse published frame: %v", err)
  }
  if env.Method != methodPublishDiagnostics {
    t.Fatalf("published method = %q, want %q", env.Method, methodPublishDiagnostics)
  }
  var params publishedDiagnostics
  if err := json.Unmarshal(env.Params, &params); err != nil {
    t.Fatalf("decode published diagnostics: %v\n%s", err, body)
  }
  return params
}
