package lspserver

import (
  "bytes"
  "strings"
  "sync"
  "testing"
)

// mutableCompletionHintSource stands in for a plugin source whose corpus changes
// mid-session. The lock is real: the proxy reads the corpus from the completion
// path while a refresh rewrites it.
type mutableCompletionHintSource struct {
  NullPluginSource
  mu    sync.RWMutex
  hints []LSPCompletionHint
}

func (s *mutableCompletionHintSource) CompletionHints() []LSPCompletionHint {
  s.mu.RLock()
  defer s.mu.RUnlock()
  return append([]LSPCompletionHint(nil), s.hints...)
}

func (s *mutableCompletionHintSource) publish(hints ...LSPCompletionHint) {
  s.mu.Lock()
  defer s.mu.Unlock()
  s.hints = hints
}

// TestLSPLateCompletionTriggerIsReportedOnce pins the one thing a corpus refresh
// still cannot deliver on its own.
//
// Trigger characters are merged into the initialize response, and the editor has
// already consumed it by the time a refresh runs. LSP's only remedy is
// client/registerCapability, which VS Code implements by adding a second
// completion provider beside the static one — every item tsgo returns would then
// be offered twice. Corrupting the compiler's list to advertise one character is
// the worse trade, so the proxy states the gap instead of hiding it. Saying it
// once per character is the whole design: a refresh runs on every save, and a
// notice repeated per save would be noise the user learns to ignore.
//
//  1. Answer initialize with tsgo's trigger characters and no corpus.
//  2. Publish a corpus whose trigger is new and refresh; expect one notice.
//  3. Refresh again, and publish a trigger tsgo already advertised; expect none.
func TestLSPLateCompletionTriggerIsReportedOnce(t *testing.T) {
  var editor bytes.Buffer
  source := &mutableCompletionHintSource{}
  proxy := NewProxy(ProxyOptions{EditorOut: &editor, Source: source})

  // Before initialize nothing is late: the corpus is still in time to be merged
  // into the response the editor has not received yet.
  source.publish(LSPCompletionHint{Scope: "jsdoc", After: "@evidence ", Items: []LSPCompletionItem{{Insert: "docs/rfc.md"}}})
  proxy.completionHintsRefreshed()
  if editor.Len() != 0 {
    t.Fatalf("a corpus discovered before initialize was reported as late:\n%s", editor.String())
  }

  source.publish()
  env, err := ParseEnvelope([]byte(`{"jsonrpc":"2.0","id":1,"result":{"capabilities":{"completionProvider":{"triggerCharacters":["@","."]}}}}`))
  if err != nil {
    t.Fatalf("initialize fixture is not a valid envelope: %v", err)
  }
  proxy.augmentInitializeResult(env)

  source.publish(LSPCompletionHint{Scope: "jsdoc", After: "@evidence ", Items: []LSPCompletionItem{{Insert: "docs/rfc.md"}}})
  proxy.completionHintsRefreshed()
  notices := logMessageNotices(editor.String())
  if len(notices) != 1 {
    t.Fatalf("a trigger character discovered after initialize produced %d notices, want 1:\n%s", len(notices), editor.String())
  }
  // The trigger is the LAST rune of After, a space here, and the notice quotes
  // it so an invisible character is still identifiable in the output channel.
  if !strings.Contains(notices[0], `\" \"`) {
    t.Errorf("the notice does not name the trigger character it is about:\n%s", notices[0])
  }
  if !strings.Contains(notices[0], "restart") {
    t.Errorf("the notice does not say what the user has to do:\n%s", notices[0])
  }

  editor.Reset()
  proxy.completionHintsRefreshed()
  if editor.Len() != 0 {
    t.Fatalf("the same late trigger was reported again on the next refresh:\n%s", editor.String())
  }

  // A trigger tsgo already advertises is not late at all — the editor is already
  // asking for completion on it, so the hint works with no restart.
  source.publish(LSPCompletionHint{Scope: "jsdoc", After: "@", Items: []LSPCompletionItem{{Insert: "param"}}})
  proxy.completionHintsRefreshed()
  if editor.Len() != 0 {
    t.Fatalf("a trigger character upstream already advertises was reported as late:\n%s", editor.String())
  }
}

// logMessageNotices extracts the window/logMessage frames written to the editor.
func logMessageNotices(stream string) []string {
  var notices []string
  for _, chunk := range strings.Split(stream, "\r\n\r\n") {
    if strings.Contains(chunk, `"window/logMessage"`) {
      notices = append(notices, chunk)
    }
  }
  return notices
}
