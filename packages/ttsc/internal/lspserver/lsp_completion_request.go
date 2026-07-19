package lspserver

import (
  "encoding/json"
  "fmt"
  "unicode/utf16"
)

const pluginCompletionDataMarker = "ttsc/completion-hint/v1"

type pendingCompletionRequest struct {
  items        []LSPCompletionItem
  replaceRange LSPRange
  hasRange     bool
}

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
  pending := p.completionItemsFor(env)
  if len(pending.items) == 0 {
    return false, nil
  }
  key := env.IDKey()
  if key == "" {
    return false, nil
  }
  p.pendingMu.Lock()
  if p.pendingCompletions == nil {
    p.pendingCompletions = map[string]pendingCompletionRequest{}
  }
  p.pendingCompletions[key] = pending
  p.pendingMu.Unlock()
  return false, nil
}

// handleCompletionResolveRequest completes plugin-owned items locally.
//
// tsgo advertises completionItem/resolve for its own items and expects its
// private data payload on every request. Plugin hints are already fully
// resolved, so forwarding one to tsgo would hand it an item it did not create.
// The private marker added while merging items is the ownership boundary.
func (p *Proxy) handleCompletionResolveRequest(env Envelope) (bool, error) {
  if !env.IsRequest() || !isPluginCompletionItem(env.Params) {
    return false, nil
  }
  return true, p.writeResult(env.ID, json.RawMessage(env.Params))
}

func isPluginCompletionItem(params json.RawMessage) bool {
  var item struct {
    Data struct {
      Marker string `json:"$ttsc"`
    } `json:"data"`
  }
  return len(params) > 0 &&
    json.Unmarshal(params, &item) == nil &&
    item.Data.Marker == pluginCompletionDataMarker
}

// completionItemsFor resolves the cursor to a line prefix and asks the corpus.
//
// Returns nothing when the document's text is unknown. Failing open — matching
// against an empty prefix — would offer every broad trigger's items at a
// position the proxy cannot see, which is worse than silence.
func (p *Proxy) completionItemsFor(env Envelope) pendingCompletionRequest {
  hints := p.pluginCompletionHints()
  if len(hints) == 0 {
    return pendingCompletionRequest{}
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
    return pendingCompletionRequest{}
  }
  text, ok := p.cachedDocumentText(params.TextDocument.URI)
  if !ok {
    return pendingCompletionRequest{}
  }
  offset, ok := offsetForPosition(text, params.Position.Line, params.Position.Character)
  if !ok {
    return pendingCompletionRequest{}
  }
  items, filter := matchCompletionHints(
    hints,
    linePrefixAt(text, offset),
    cursorInJSDoc(text, offset),
  )
  if len(items) == 0 {
    return pendingCompletionRequest{}
  }
  filterUnits := utf16Length(filter)
  if filterUnits > params.Position.Character {
    return pendingCompletionRequest{}
  }
  return pendingCompletionRequest{
    items: items,
    replaceRange: LSPRange{
      Start: LSPPosition{
        Line:      params.Position.Line,
        Character: params.Position.Character - filterUnits,
      },
      End: LSPPosition(params.Position),
    },
    hasRange: true,
  }
}

func utf16Length(text string) int {
  units := 0
  for _, symbol := range text {
    width := utf16.RuneLen(symbol)
    if width <= 0 {
      width = 1
    }
    units += width
  }
  return units
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
  return mergeCompletionResponseWithRequest(body, pendingCompletionRequest{items: items})
}

func mergeCompletionResponseWithRequest(body []byte, pending pendingCompletionRequest) []byte {
  if len(pending.items) == 0 {
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

  encoded := make([]json.RawMessage, 0, len(pending.items))
  for index, item := range pending.items {
    label := item.Label
    if label == "" {
      label = item.Insert
    }
    entry := map[string]any{"label": label}
    entry["insertText"] = item.Insert
    // Matching uses Insert, so keep client-side filtering on the same value.
    // A friendlier Label may omit a path prefix that the user already typed.
    entry["filterText"] = item.Insert
    entry["sortText"] = fmt.Sprintf("ttsc:%010d", index)
    entry["data"] = map[string]string{"$ttsc": pluginCompletionDataMarker}
    // CompletionList.itemDefaults belong to upstream items. State every
    // defaultable value a plugin item owns so an upstream snippet or commit
    // character default cannot silently change a plain-text hint.
    entry["commitCharacters"] = []string{}
    entry["insertTextFormat"] = 1
    entry["insertTextMode"] = 1
    if pending.hasRange {
      entry["textEdit"] = map[string]any{
        "range":   pending.replaceRange,
        "newText": item.Insert,
      }
    }
    if item.Detail != "" {
      entry["detail"] = item.Detail
    }
    raw, err := json.Marshal(entry)
    if err != nil {
      return body
    }
    encoded = append(encoded, raw)
  }

  list := map[string]json.RawMessage{}
  existing := []json.RawMessage{}
  switch {
  case len(envelope.Result) == 0 || string(envelope.Result) == "null":
    list["isIncomplete"] = json.RawMessage("false")
  case envelope.Result[0] == '[':
    if json.Unmarshal(envelope.Result, &existing) != nil {
      return body
    }
    list["isIncomplete"] = json.RawMessage("false")
  default:
    if json.Unmarshal(envelope.Result, &list) != nil {
      return body
    }
    if rawItems, exists := list["items"]; exists && json.Unmarshal(rawItems, &existing) != nil {
      return body
    }
    normalized, ok := normalizeCompletionListDefaults(list, existing)
    if !ok {
      return body
    }
    existing = normalized
  }
  existing = append(existing, encoded...)
  mergedItems, err := json.Marshal(existing)
  if err != nil {
    return body
  }
  list["items"] = mergedItems

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

// normalizeCompletionListDefaults materializes merge-kind defaults into the
// upstream items before plugin items are appended. Otherwise a CompletionList
// default such as data or commitCharacters would also merge into plugin items
// even though those defaults belong to tsgo's producer. Unknown defaults fail
// closed because a future protocol field could change plugin item semantics.
func normalizeCompletionListDefaults(
  list map[string]json.RawMessage,
  items []json.RawMessage,
) ([]json.RawMessage, bool) {
  rawDefaults, hasDefaults := list["itemDefaults"]
  if !hasDefaults {
    return items, true
  }
  defaults := map[string]json.RawMessage{}
  if json.Unmarshal(rawDefaults, &defaults) != nil {
    return nil, false
  }
  supportedDefaults := map[string]struct{}{
    "commitCharacters": {},
    "data":             {},
    "editRange":        {},
    "insertTextFormat": {},
    "insertTextMode":   {},
  }
  for field := range defaults {
    if _, supported := supportedDefaults[field]; !supported {
      return nil, false
    }
  }

  rawApplyKind, hasApplyKind := list["applyKind"]
  if !hasApplyKind {
    return items, true
  }
  applyKind := map[string]json.RawMessage{}
  if json.Unmarshal(rawApplyKind, &applyKind) != nil {
    return nil, false
  }
  for field, rawKind := range applyKind {
    var kind int
    if json.Unmarshal(rawKind, &kind) != nil || (kind != 1 && kind != 2) {
      return nil, false
    }
    if field != "commitCharacters" && field != "data" {
      if kind == 2 {
        return nil, false
      }
      continue
    }
    if kind != 2 {
      continue
    }
    defaultValue, exists := defaults[field]
    if exists {
      materialized, ok := materializeCompletionDefault(items, field, defaultValue)
      if !ok {
        return nil, false
      }
      items = materialized
    }
    applyKind[field] = json.RawMessage("1")
  }
  normalizedApplyKind, err := json.Marshal(applyKind)
  if err != nil {
    return nil, false
  }
  list["applyKind"] = normalizedApplyKind
  return items, true
}

func materializeCompletionDefault(
  items []json.RawMessage,
  field string,
  defaultValue json.RawMessage,
) ([]json.RawMessage, bool) {
  materialized := make([]json.RawMessage, 0, len(items))
  for _, rawItem := range items {
    item := map[string]json.RawMessage{}
    if json.Unmarshal(rawItem, &item) != nil {
      return nil, false
    }
    if itemValue, exists := item[field]; exists {
      merged, ok := mergeCompletionDefault(field, itemValue, defaultValue)
      if !ok {
        return nil, false
      }
      item[field] = merged
    } else {
      item[field] = defaultValue
    }
    rawMaterialized, err := json.Marshal(item)
    if err != nil {
      return nil, false
    }
    materialized = append(materialized, rawMaterialized)
  }
  return materialized, true
}

func mergeCompletionDefault(
  field string,
  itemValue json.RawMessage,
  defaultValue json.RawMessage,
) (json.RawMessage, bool) {
  switch field {
  case "commitCharacters":
    var itemCharacters []string
    var defaultCharacters []string
    if json.Unmarshal(itemValue, &itemCharacters) != nil ||
      json.Unmarshal(defaultValue, &defaultCharacters) != nil {
      return nil, false
    }
    seen := make(map[string]struct{}, len(itemCharacters)+len(defaultCharacters))
    merged := make([]string, 0, len(itemCharacters)+len(defaultCharacters))
    for _, characters := range [][]string{itemCharacters, defaultCharacters} {
      for _, character := range characters {
        if _, exists := seen[character]; exists {
          continue
        }
        seen[character] = struct{}{}
        merged = append(merged, character)
      }
    }
    rawMerged, err := json.Marshal(merged)
    return rawMerged, err == nil
  case "data":
    defaults := map[string]json.RawMessage{}
    item := map[string]json.RawMessage{}
    if json.Unmarshal(defaultValue, &defaults) != nil || json.Unmarshal(itemValue, &item) != nil {
      return nil, false
    }
    for key, value := range item {
      defaults[key] = value
    }
    rawMerged, err := json.Marshal(defaults)
    return rawMerged, err == nil
  default:
    return nil, false
  }
}
