package lspserver

import (
  "bytes"
  "strings"
  "sync"
  "testing"
)

// mutableCompletionHintSource owns the supplied corpus for direct proxy calls.
// Its mutex protects publication and shallow slice copying; this test uses those
// operations sequentially and does not mutate the nested item slices.
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

// TestLSPLateCompletionTriggerIsReportedOnce observes the proxy's late-trigger
// notice policy using an owned mutable corpus and a buffered editor output.
// Calling augmentInitializeResult records the supplied upstream trigger set;
// its returned response is not sent to or consumed by an editor in this unit.
// The test does not execute client capability registration, completion requests
// or an editor's provider behavior.
//
//  1. Keep a pre-initialize corpus quiet, then record supplied upstream triggers.
//  2. Publish a corpus whose trigger is new and refresh; expect one notice.
//  3. Refresh again, and publish a trigger tsgo already advertised; expect none.
//
// @evidence contracts/testing.md#behavioral-verification Direct refresh notifications before recorded initialize state emit nothing; a later space trigger emits one buffered window/logMessage notice containing the quoted space and restart text, while its repeat and an advertised @ trigger emit no bytes. This does not observe client delivery or completion item behavior.
// @evidence contracts/testing.md#independent-expectations Literal zero/one notice counts, quoted-space text and restart text distinguish the supplied policy stages. The notice helper selects stream chunks containing the method text; it does not independently validate frame lengths or every JSON field.
// @evidence contracts/testing.md#distinguishing-cases The same space corpus is quiet before initialize and reported afterward, then remains quiet on repetition; an upstream-advertised @ corpus is also quiet. Only these supplied trigger distinctions are exercised.
// @evidence contracts/testing.md#execution-ownership The discoverable Go unit directly calls Proxy augmentation and refresh operations with an owned optional CompletionHints source and bytes.Buffer output. It creates no temporary project, native child, installed consumer or product host; the source's mutex is real but this body runs its writes and reads sequentially.
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

  // The supplied initialize result advertised @, so it is not a late trigger.
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
