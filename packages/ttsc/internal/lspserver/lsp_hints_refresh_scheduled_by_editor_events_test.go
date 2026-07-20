package lspserver

import (
  "io"
  "sync/atomic"
  "testing"
)

// refreshCountingSource records how often the proxy asked for a corpus
// rediscovery. It counts atomically because didSave also starts an asynchronous
// diagnostics publication against the same source.
type refreshCountingSource struct {
  NullPluginSource
  refreshes atomic.Int64
}

func (s *refreshCountingSource) CompletionHints() []LSPCompletionHint { return nil }

func (s *refreshCountingSource) RefreshCompletionHints() { s.refreshes.Add(1) }

// TestLSPHintsRefreshScheduledByEditorEvents pins which editor notifications
// rediscover the corpus.
//
// The corpus projects what a rule's Check found on the saved project, so the
// events that can invalidate it are the ones that change that project: a saved
// document, a config change from the editor, a watched file rewritten outside
// it. The negative half matters just as much. didChange fires per keystroke and
// leaves disk untouched, and a refresh spawns a sidecar per plugin, so
// refreshing there would put a process spawn on the typing path — the one thing
// this channel must never do.
//
//  1. Send each notification that must schedule a refresh.
//  2. Assert one refresh per notification.
//  3. Send the notifications that must not, and assert the count is unchanged.
func TestLSPHintsRefreshScheduledByEditorEvents(t *testing.T) {
  source := &refreshCountingSource{}
  proxy := NewProxy(ProxyOptions{
    EditorOut:  io.Discard,
    UpstreamIn: io.Discard,
    Source:     source,
  })

  refreshing := []string{
    `{"jsonrpc":"2.0","method":"textDocument/didSave","params":{"textDocument":{"uri":"file:///a.ts"}}}`,
    `{"jsonrpc":"2.0","method":"workspace/didChangeConfiguration","params":{"settings":{}}}`,
    `{"jsonrpc":"2.0","method":"workspace/didChangeWatchedFiles","params":{"changes":[{"uri":"file:///lint.config.ts","type":2}]}}`,
    // Params the proxy cannot read take the conservative branch: it cannot tell
    // which inputs changed, so it assumes they all did — the same answer it
    // gives the resident daemon there.
    `{"jsonrpc":"2.0","method":"workspace/didChangeWatchedFiles"}`,
  }
  for index, body := range refreshing {
    handleEditorFrame(t, proxy, body)
    if got := source.refreshes.Load(); got != int64(index+1) {
      t.Fatalf("after %s the source had been refreshed %d times, want %d", body, got, index+1)
    }
  }

  quiet := []string{
    // An editor that reports no change gets no refresh: the proxy already
    // refuses to drop the resident daemon's warm Program for that notification,
    // and a corpus refresh costs a whole Program load per plugin.
    `{"jsonrpc":"2.0","method":"workspace/didChangeWatchedFiles","params":{"changes":[]}}`,
    `{"jsonrpc":"2.0","method":"textDocument/didChange","params":{"textDocument":{"uri":"file:///a.ts","version":2},"contentChanges":[{"text":"const a = 1;"}]}}`,
    `{"jsonrpc":"2.0","method":"textDocument/didOpen","params":{"textDocument":{"uri":"file:///a.ts","languageId":"typescript","version":1,"text":"const a = 1;"}}}`,
    `{"jsonrpc":"2.0","method":"textDocument/didClose","params":{"textDocument":{"uri":"file:///a.ts"}}}`,
    `{"jsonrpc":"2.0","id":7,"method":"textDocument/completion","params":{"textDocument":{"uri":"file:///a.ts"},"position":{"line":0,"character":0}}}`,
  }
  for _, body := range quiet {
    handleEditorFrame(t, proxy, body)
  }
  if got := source.refreshes.Load(); got != int64(len(refreshing)) {
    t.Fatalf(
      "an event that cannot change the saved project refreshed the corpus (%d refreshes, want %d); "+
        "a refresh spawns a sidecar per plugin",
      got, len(refreshing),
    )
  }
}

func handleEditorFrame(t *testing.T, proxy *Proxy, body string) {
  t.Helper()
  env, err := ParseEnvelope([]byte(body))
  if err != nil {
    t.Fatalf("test frame is not a valid envelope: %v", err)
  }
  if _, err := proxy.handleEditorEnvelope(env, []byte(body)); err != nil {
    t.Fatalf("handling %s failed: %v", env.Method, err)
  }
}
