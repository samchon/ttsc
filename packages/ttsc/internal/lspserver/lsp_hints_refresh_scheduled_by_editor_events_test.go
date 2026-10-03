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
// An owned optional-capability source records refresh dispatch. The authored
// positive and quiet notification lists distinguish the proxy's routing policy;
// no actual hint rediscovery, process spawn, Program load or typing latency is
// observed. Quiet events are exercised as a batch and checked by its final
// monotonic count.
//
//  1. Send each notification that must schedule a refresh.
//  2. Assert one refresh per notification.
//  3. Send the notifications that must not, and assert the count is unchanged.
//
// @evidence contracts/testing.md#behavioral-verification Actual handleEditorEnvelope increments the owned RefreshCompletionHints recorder once after each of eight authored positive notifications, including JSON membership/content, package metadata and unreadable watched params. Five quiet notifications leave the final count unchanged. This observes dispatch, not completion of rediscovery.
// @evidence contracts/testing.md#independent-expectations The expected refresh counts are literal per notification.
// @evidence contracts/testing.md#distinguishing-cases Saved/config/watched input notifications are positive; empty watched changes, didChange, didOpen, didClose and an empty-source completion request are quiet. No real disk mutation or universal notification classification is certified.
// @evidence contracts/testing.md#execution-ownership This Go unit builds the actual Proxy with supported discard streams and an owned optional refresher embedding NullPluginSource, parses authored envelopes and invokes the actual handler. It creates no directory or sidecar and starts no compiler, process or host. Document handlers may attempt native read-only disk checks for supplied URIs and schedule NullPluginSource diagnostics without a joined/result oracle; only synchronous refresh counts are asserted.
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
    // JSON can be a resolveJsonModule source even when no ProjectRule declares
    // it. Content and membership changes therefore invalidate the Program-wide
    // hint corpus just like TypeScript changes do.
    `{"jsonrpc":"2.0","method":"workspace/didChangeWatchedFiles","params":{"changes":[{"uri":"file:///src/data.json","type":1}]}}`,
    `{"jsonrpc":"2.0","method":"workspace/didChangeWatchedFiles","params":{"changes":[{"uri":"file:///src/data.json","type":2}]}}`,
    `{"jsonrpc":"2.0","method":"workspace/didChangeWatchedFiles","params":{"changes":[{"uri":"file:///src/data.json","type":3}]}}`,
    // Package metadata participates in module resolution independently of
    // ProjectRule ownership.
    `{"jsonrpc":"2.0","method":"workspace/didChangeWatchedFiles","params":{"changes":[{"uri":"file:///package.json","type":2}]}}`,
    // Params the proxy cannot read take the conservative branch: it cannot tell
    // which inputs changed, so it assumes they all did — the same answer it
    // gives the resident daemon there.
    `{"jsonrpc":"2.0","method":"workspace/didChangeWatchedFiles"}`,
  }
  for index, body := range refreshing {
    handleHintRefreshEditorFrame(t, proxy, body)
    if got := source.refreshes.Load(); got != int64(index+1) {
      t.Fatalf("after %s the source had been refreshed %d times, want %d", body, got, index+1)
    }
  }

  quiet := []string{
    // An empty change list dispatches no refresh.
    `{"jsonrpc":"2.0","method":"workspace/didChangeWatchedFiles","params":{"changes":[]}}`,
    `{"jsonrpc":"2.0","method":"textDocument/didChange","params":{"textDocument":{"uri":"file:///a.ts","version":2},"contentChanges":[{"text":"const a = 1;"}]}}`,
    `{"jsonrpc":"2.0","method":"textDocument/didOpen","params":{"textDocument":{"uri":"file:///a.ts","languageId":"typescript","version":1,"text":"const a = 1;"}}}`,
    `{"jsonrpc":"2.0","method":"textDocument/didClose","params":{"textDocument":{"uri":"file:///a.ts"}}}`,
    `{"jsonrpc":"2.0","id":7,"method":"textDocument/completion","params":{"textDocument":{"uri":"file:///a.ts"},"position":{"line":0,"character":0}}}`,
  }
  for _, body := range quiet {
    handleHintRefreshEditorFrame(t, proxy, body)
  }
  if got := source.refreshes.Load(); got != int64(len(refreshing)) {
    t.Fatalf(
      "the authored quiet event batch dispatched a refresh (%d refreshes, want %d)",
      got, len(refreshing),
    )
  }
}

func handleHintRefreshEditorFrame(t *testing.T, proxy *Proxy, body string) {
  t.Helper()
  env, err := ParseEnvelope([]byte(body))
  if err != nil {
    t.Fatalf("test frame is not a valid envelope: %v", err)
  }
  if _, err := proxy.handleEditorEnvelope(env, []byte(body)); err != nil {
    t.Fatalf("handling %s failed: %v", env.Method, err)
  }
}
