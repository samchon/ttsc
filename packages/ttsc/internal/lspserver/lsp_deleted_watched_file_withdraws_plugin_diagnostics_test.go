package lspserver

import (
  "bytes"
  "encoding/json"
  "io"
  "testing"
)

// TestLSPDeletedWatchedFileWithdrawsPluginDiagnostics verifies that deleting a
// reported watched-file URI withdraws its supplied cached plugin finding while
// retaining a supplied cached upstream message in the emitted frame.
//
// This unit supplies deletion/change notifications without creating or deleting
// a physical file. It observes the buffered notification and handler return,
// not a compiler Program, actual upstream forwarding or editor presentation.
//
//  1. Seed one upstream and one plugin diagnostic for a document.
//  2. Send a watched-file deletion for that document.
//  3. Assert the republished set keeps the upstream diagnostic and drops the
//     plugin one, and that a plain change publishes nothing by itself.
//
// @evidence contracts/testing.md#behavioral-verification Actual handleEditorEnvelope on a supplied deletion notification returns handled=false and emits a publishDiagnostics frame for the expected URI containing only the literal cached upstream message. A subsequent supplied change notification emits no editor bytes; that branch does not inspect retained plugin-cache contents or recomputation.
// @evidence contracts/testing.md#independent-expectations The expected published diagnostic sets are literals for the deleted document.
// @evidence contracts/testing.md#distinguishing-cases Plugin findings and compiler diagnostics for one URI are separate sets, and only the plugin set is cleared.
// @evidence contracts/testing.md#execution-ownership This Go unit creates an actual Proxy with supported bytes.Buffer editor output, io.Discard upstream input and NullPluginSource, seeds its caches through their owning methods and invokes the actual notification handler. The emitted frame is decoded through actual frame/envelope readers and compared to literal URI/message expectations. No physical file, sidecar, compiler, process or product host runs; handled=false does not itself observe upstream forwarding.
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

  // Negative twin: a supplied ordinary change emits no notification here.
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
