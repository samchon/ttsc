package lspserver

import (
  "encoding/json"
)

// handleCompletionRequest computes the plugin's contribution for a cursor and
// remembers it for the response.
//
// It always forwards. tsgo owns completion everywhere a plugin does not, and
// answering locally would replace the compiler's suggestions with a rule's — so
// the request goes upstream and the plugin's items are appended to whatever
// comes back.
//
// It does NOT bail on a dirty buffer, unlike codeAction. A dirty buffer is
// precisely when completion is wanted: the user is mid-word. The live text the
// proxy already splices per didChange is the right source, and the only one
// that exists mid-edit.
func (p *Proxy) handleCompletionRequest(env Envelope) (bool, error) {
  items := p.completionItemsFor(env)
  if len(items) == 0 {
    return false, nil
  }
  key := env.IDKey()
  if key == "" {
    return false, nil
  }
  p.pendingMu.Lock()
  if p.pendingCompletions == nil {
    p.pendingCompletions = map[string][]LSPCompletionItem{}
  }
  p.pendingCompletions[key] = items
  p.pendingMu.Unlock()
  return false, nil
}

// completionItemsFor resolves the cursor to a line prefix and asks the corpus.
//
// Returns nothing when the document's text is unknown. Failing open — matching
// against an empty prefix — would offer every broad trigger's items at a
// position the proxy cannot see, which is worse than silence.
func (p *Proxy) completionItemsFor(env Envelope) []LSPCompletionItem {
  hints := p.pluginCompletionHints()
  if len(hints) == 0 {
    return nil
  }
  var params struct {
    TextDocument struct {
      URI string `json:"uri"`
    } `json:"textDocument"`
    Position struct {
      Line      int `json:"line"`
      Character int `json:"character"`
    } `json:"position"`
  }
  if len(env.Params) == 0 || json.Unmarshal(env.Params, &params) != nil {
    return nil
  }
  text, ok := p.cachedDocumentText(params.TextDocument.URI)
  if !ok {
    return nil
  }
  offset, ok := offsetForPosition(text, params.Position.Line, params.Position.Character)
  if !ok {
    return nil
  }
  items, _ := matchCompletionHints(
    hints,
    linePrefixAt(text, offset),
    cursorInJSDoc(text, offset),
  )
  return items
}

// offsetForPosition converts an LSP line/character to a byte offset.
//
// LSP counts characters in UTF-16 code units by default, so a line holding an
// emoji or a CJK character past the BMP would land the cursor mid-token if
// counted as bytes. The conversion walks the line's runes and spends the
// position's UTF-16 budget as it goes.
func offsetForPosition(text string, line int, character int) (int, bool) {
  offset := 0
  for current := 0; current < line; current++ {
    next := indexByteFrom(text, offset, '\n')
    if next == -1 {
      return 0, false
    }
    offset = next + 1
  }
  units := 0
  for index, symbol := range text[offset:] {
    if units >= character {
      return offset + index, true
    }
    if symbol == '\n' || symbol == '\r' {
      return offset + index, true
    }
    if symbol > 0xFFFF {
      units += 2
    } else {
      units++
    }
  }
  return len(text), true
}

func indexByteFrom(text string, from int, target byte) int {
  for index := from; index < len(text); index++ {
    if text[index] == target {
      return index
    }
  }
  return -1
}

// mergeCompletionResponse appends the plugin's items to upstream's answer.
//
// The response may be a bare item array, a CompletionList, or null — all three
// are legal, and tsgo picks per request. Each is handled rather than assumed:
// guessing wrong here does not error, it silently drops either the plugin's
// items or the compiler's.
//
// `isIncomplete` is preserved when upstream set it and left false when
// synthesizing over a null. That flag is upstream's to own: it says whether the
// list must be recomputed as the user types, and only tsgo knows that about its
// own items. Ours are complete by construction — the corpus is already in
// memory — so re-merging per keystroke is free either way.
func mergeCompletionResponse(body []byte, items []LSPCompletionItem) []byte {
  if len(items) == 0 {
    return body
  }
  var envelope struct {
    JSONRPC string          `json:"jsonrpc"`
    ID      json.RawMessage `json:"id"`
    Result  json.RawMessage `json:"result"`
    Error   json.RawMessage `json:"error,omitempty"`
  }
  if json.Unmarshal(body, &envelope) != nil || len(envelope.Error) > 0 {
    // An upstream error is upstream's to report. Appending completions to it
    // would turn a failure into a half-answer.
    return body
  }

  encoded := make([]map[string]any, 0, len(items))
  for _, item := range items {
    entry := map[string]any{"label": item.Label}
    if item.Label == "" {
      entry["label"] = item.Insert
    }
    entry["insertText"] = item.Insert
    if item.Detail != "" {
      entry["detail"] = item.Detail
    }
    encoded = append(encoded, entry)
  }

  var list struct {
    IsIncomplete bool             `json:"isIncomplete"`
    Items        []map[string]any `json:"items"`
  }
  switch {
  case len(envelope.Result) == 0 || string(envelope.Result) == "null":
    list.Items = encoded
  case envelope.Result[0] == '[':
    if json.Unmarshal(envelope.Result, &list.Items) != nil {
      return body
    }
    list.Items = append(list.Items, encoded...)
  default:
    if json.Unmarshal(envelope.Result, &list) != nil {
      return body
    }
    list.Items = append(list.Items, encoded...)
  }

  result, err := json.Marshal(list)
  if err != nil {
    return body
  }
  merged, err := json.Marshal(map[string]any{
    "jsonrpc": envelope.JSONRPC,
    "id":      json.RawMessage(envelope.ID),
    "result":  json.RawMessage(result),
  })
  if err != nil {
    return body
  }
  return merged
}
